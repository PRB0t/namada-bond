mod args;
pub mod io;
pub mod masp;
mod signature;
mod transaction;
mod tx;
mod wallet;

use self::io::WebIo;
use crate::rpc_client::HttpClient;
use crate::types::genesis::{GenesisSignature, GetTxSignatureResponse};
use crate::utils::set_panic_hook;
#[cfg(feature = "web")]
use crate::utils::to_bytes;
use crate::utils::to_js_result;
use gloo_utils::format::JsValueSerdeExt;
use namada_sdk::address::Address;
use namada_sdk::borsh::BorshSerializeExt;
use namada_sdk::borsh::{self, BorshDeserialize};
use namada_sdk::chain::ChainId;
use namada_sdk::eth_bridge::bridge_pool::build_bridge_pool_tx;
use namada_sdk::hash::Hash;
use namada_sdk::key::RefTo;
use namada_sdk::key::{common, ed25519, SigScheme};
use namada_sdk::masp::ShieldedContext;
use namada_sdk::rpc::query_epoch;
use namada_sdk::signing::SigningTxData;
use namada_sdk::string_encoding::Format;
use namada_sdk::time::DateTimeUtc;
use namada_sdk::token::DenominatedAmount;
use namada_sdk::tx::data::{pos, Fee, TxType};
use namada_sdk::tx::{
    build_batch, build_bond, build_claim_rewards, build_ibc_transfer, build_redelegation,
    build_reveal_pk, build_transparent_transfer, build_unbond, build_vote_proposal, build_withdraw,
    process_tx, Code, Commitment, Data, ProcessTxResponse, Section, Tx,
};
use namada_sdk::wallet::{Store, Wallet};
use namada_sdk::{Namada, NamadaImpl};
use std::str::FromStr;
use wasm_bindgen::{prelude::wasm_bindgen, JsError, JsValue};
/// Represents the Sdk public API.
#[wasm_bindgen]
pub struct Sdk {
    namada: NamadaImpl<HttpClient, wallet::JSWalletUtils, masp::JSShieldedUtils, WebIo>,
}

#[wasm_bindgen]
/// Sdk mostly wraps the logic of the Sdk struct members, making it a part of public API.
/// For more details, navigate to the corresponding modules.
impl Sdk {
    #[wasm_bindgen(constructor)]
    pub fn new(url: String, native_token: String, path_or_db_name: String) -> Self {
        set_panic_hook();
        let client: HttpClient = HttpClient::new(url);
        let wallet: Wallet<wallet::JSWalletUtils> = Wallet::new(
            wallet::JSWalletUtils::new_utils(&path_or_db_name),
            Store::default(),
        );
        let shielded_ctx: ShieldedContext<masp::JSShieldedUtils> = ShieldedContext::default();

        let namada = NamadaImpl::native_new(
            client,
            wallet,
            shielded_ctx,
            WebIo,
            //NAM address
            Address::from_str(&native_token).unwrap(),
        );

        Sdk { namada }
    }

    pub async fn has_masp_params() -> Result<JsValue, JsValue> {
        let has = has_masp_params().await?;

        Ok(js_sys::Boolean::from(has.as_bool().unwrap()).into())
    }

    pub async fn fetch_and_store_masp_params() -> Result<(), JsValue> {
        fetch_and_store_masp_params().await?;
        Ok(())
    }

    #[cfg(feature = "web")]
    pub async fn load_masp_params(&self, _db_name: JsValue) -> Result<(), JsValue> {
        // _dn_name is not used in the web version for a time being
        let params = get_masp_params().await?;
        let params_iter = js_sys::try_iter(&params)?.ok_or_else(|| "Can't iterate over JsValue")?;
        let mut params_bytes = params_iter.map(|p| to_bytes(p.unwrap()));

        let spend = params_bytes.next().unwrap();
        let output = params_bytes.next().unwrap();
        let convert = params_bytes.next().unwrap();

        // We are making sure that there are no more params left
        assert_eq!(params_bytes.next(), None);

        let mut shielded = self.namada.shielded_mut().await;
        *shielded = masp::JSShieldedUtils::new(spend, output, convert).await?;

        Ok(())
    }

    #[cfg(feature = "nodejs")]
    pub async fn load_masp_params(&self, context_dir: JsValue) -> Result<(), JsValue> {
        let context_dir = context_dir.as_string().unwrap();

        let mut shielded = self.namada.shielded_mut().await;
        *shielded = masp::JSShieldedUtils::new(&context_dir).await;

        Ok(())
    }

    pub async fn add_spending_key(&self, xsk: String, alias: String) {
        let mut wallet = self.namada.wallet_mut().await;
        wallet::add_spending_key(&mut wallet, xsk, alias)
    }

    pub async fn add_viewing_key(&self, xvk: String, alias: String) {
        let mut wallet = self.namada.wallet_mut().await;
        wallet::add_viewing_key(&mut wallet, xvk, alias)
    }

    pub async fn add_payment_address(&self, pa: String, alias: String) {
        let mut wallet = self.namada.wallet_mut().await;
        wallet::add_payment_address(&mut wallet, pa, alias)
    }

    pub async fn add_default_payment_address(&self, xvk: String, alias: String) {
        let mut wallet = self.namada.wallet_mut().await;
        wallet::add_default_payment_address(&mut wallet, xvk, alias)
    }

    pub async fn add_keypair(&self, secret_key: String, alias: String, password: Option<String>) {
        let mut wallet = self.namada.wallet_mut().await;
        wallet::add_keypair(&mut wallet, secret_key, alias, password)
    }

    pub async fn save_wallet(&self) -> Result<(), JsValue> {
        let wallet = self.namada.wallet_mut().await;
        wallet.save().map_err(JsError::from)?;

        Ok(())
    }

    pub async fn load_wallet(&self) -> Result<(), JsValue> {
        let mut wallet = self.namada.wallet_mut().await;
        wallet.load().map_err(JsError::from)?;

        Ok(())
    }

    pub async fn sign_tx(
        &self,
        tx: Vec<u8>,
        private_key: Option<String>,
        chain_id: Option<String>,
    ) -> Result<JsValue, JsError> {
        let tx: tx::Tx = borsh::from_slice(&tx)?;
        let mut namada_tx: Tx = borsh::from_slice(&tx.tx_bytes())?;

        // If chain_id is provided, validate this against value in Tx header
        if let Some(c) = chain_id {
            if c != namada_tx.header.chain_id.to_string() {
                return Err(JsError::new(&format!(
                    "chain_id {} does not match Tx header chain_id {}",
                    &c,
                    namada_tx.header.chain_id.as_str()
                )));
            }
        }

        let signing_keys = match private_key.clone() {
            Some(private_key) => vec![common::SecretKey::Ed25519(ed25519::SecretKey::from_str(
                &private_key,
            )?)],
            // If no private key is provided, we assume masp source and return empty vec
            None => vec![],
        };

        for signing_tx_data in tx.signing_tx_data()? {
            if let Some(account_public_keys_map) = signing_tx_data.account_public_keys_map.clone() {
                // We only sign the raw header for transfers from transparent source
                if !signing_keys.is_empty() {
                    // Sign the raw header
                    namada_tx.sign_raw(
                        signing_keys.clone(),
                        account_public_keys_map,
                        signing_tx_data.owner.clone(),
                    );
                }
            }
        }

        // The key is either passed private key for transparent sources or the disposable signing
        // key for shielded sources
        let key = signing_keys[0].clone();

        // Sign the fee header
        namada_tx.sign_wrapper(key);

        to_js_result(borsh::to_vec(&namada_tx)?)
    }

    // get signature from tx
    pub async fn get_tx_signature(
        &self,
        tx_bytes: &[u8],
        public_key: &str,
    ) -> Result<JsValue, JsError> {
        let tx = Tx::try_from_slice(tx_bytes)?;
        let raw_header_hash = tx.raw_header_hash();

        // Extract signature from section
        let sigs = tx
            .clone()
            .sections
            .into_iter()
            .find_map(|sec| {
                if let Section::Authorization(signatures) = sec {
                    if [raw_header_hash] == signatures.targets.as_slice() {
                        Some(signatures)
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .unwrap();

        // Init response struct
        let mut final_signs: GetTxSignatureResponse = GetTxSignatureResponse {
            signatures: Vec::new(),
        };

        // Convert signatures to strings - so we don't have to go crazy on the typescript side of this
        for (_, sig) in sigs.signatures.into_iter() {
            final_signs.signatures.push(GenesisSignature {
                pub_key: public_key.into(),
                signature: sig.to_string(),
            });
        }

        to_js_result(borsh::to_vec(&final_signs)?)
    }

    // Broadcast Tx
    pub async fn process_tx(&self, tx_bytes: &[u8], tx_msg: &[u8]) -> Result<JsValue, JsError> {
        let args = args::tx_args_from_slice(tx_msg)?;

        let tx = Tx::try_from_slice(tx_bytes)?;
        let cmts = tx.commitments().clone();
        let hash = tx.header_hash().to_string();
        let resp = process_tx(&self.namada, &args, tx.clone()).await?;

        let mut batch_tx_results: Vec<tx::BatchTxResult> = vec![];

        for cmt in cmts {
            let response = resp.is_applied_and_valid(Some(&tx.header_hash()), &cmt);
            let hash = cmt.get_hash().to_string();

            batch_tx_results.push(tx::BatchTxResult::new(hash, response.is_some()));
        }

        // Collect results and return
        match resp {
            ProcessTxResponse::Applied(tx_response) => {
                let code = tx_response.code.to_string();
                let gas_used = tx_response.gas_used.to_string();
                let height = tx_response.height.to_string();
                let info = tx_response.info.to_string();
                let log = tx_response.log.to_string();

                let response =
                    tx::TxResponse::new(code, batch_tx_results, gas_used, hash, height, info, log);
                to_js_result(borsh::to_vec(&response)?)
            }
            _ => return Err(JsError::new(&format!("Tx not applied: {}", &hash))),
        }
    }

    /// Build a batch Tx from built transactions and return the bytes
    pub fn build_batch(txs: JsValue) -> Result<JsValue, JsError> {
        let mut built_txs: Vec<tx::Tx> = vec![];
        let built_txs_bytes: Vec<Vec<u8>> = txs.into_serde().unwrap();

        for bytes in built_txs_bytes.iter() {
            let tx: tx::Tx = borsh::from_slice(&bytes)?;
            built_txs.push(tx);
        }

        // Get wrapper args
        let first_tx = built_txs
            .get(0)
            .expect("At least one Tx is required for building batches!");

        let args = first_tx.args();

        let mut txs: Vec<(Tx, SigningTxData)> = vec![];

        // Iterate through provided tx::Tx and deserialize bytes to Namada Tx
        for built_tx in built_txs.into_iter() {
            let tx_bytes = built_tx.tx_bytes();
            let signing_tx_data = built_tx.signing_tx_data()?;
            let tx: Tx = Tx::try_from_slice(&tx_bytes)?;
            let first_signing_data = signing_tx_data
                .get(0)
                .expect("At least one signing data should be present on a Tx");

            txs.push((tx, first_signing_data.to_owned()));
        }

        let (tx, signing_data) = build_batch(txs.clone())?;

        to_js_result(borsh::to_vec(&tx::Tx::new(
            tx,
            &borsh::to_vec(&args)?,
            signing_data,
        )?)?)
    }

    // Append signatures and return tx bytes
    pub fn append_signature(
        &self,
        tx_bytes: &[u8],
        sig_msg_bytes: &[u8],
    ) -> Result<JsValue, JsError> {
        let mut tx: Tx = Tx::try_from_slice(tx_bytes)?;
        let signature::SignatureMsg {
            pubkey,
            raw_indices,
            raw_signature,
            wrapper_indices,
            wrapper_signature,
        } = signature::SignatureMsg::try_from_slice(&sig_msg_bytes)?;

        let raw_sig_section =
            signature::construct_signature_section(&pubkey, &raw_indices, &raw_signature, &tx)?;
        tx.add_section(raw_sig_section);

        let wrapper_sig_section = signature::construct_signature_section(
            &pubkey,
            &wrapper_indices,
            &wrapper_signature,
            &tx,
        )?;
        tx.add_section(wrapper_sig_section);

        tx.protocol_filter();

        to_js_result(borsh::to_vec(&tx)?)
    }

    pub async fn build_transparent_transfer(
        &self,
        transfer_msg: &[u8],
        wrapper_tx_msg: &[u8],
    ) -> Result<JsValue, JsError> {
        let mut args = args::transparent_transfer_tx_args(transfer_msg, wrapper_tx_msg)?;
        let (tx, signing_data) = build_transparent_transfer(&self.namada, &mut args).await?;
        self.serialize_tx_result(tx, wrapper_tx_msg, signing_data)
    }

    pub async fn build_ibc_transfer(
        &self,
        ibc_transfer_msg: &[u8],
        wrapper_tx_msg: &[u8],
    ) -> Result<JsValue, JsError> {
        let args = args::ibc_transfer_tx_args(ibc_transfer_msg, wrapper_tx_msg)?;
        let (tx, signing_data, _) = build_ibc_transfer(&self.namada, &args).await?;
        self.serialize_tx_result(tx, wrapper_tx_msg, signing_data)
    }

    pub async fn build_eth_bridge_transfer(
        &self,
        eth_bridge_transfer_msg: &[u8],
        wrapper_tx_msg: &[u8],
    ) -> Result<JsValue, JsError> {
        let args = args::eth_bridge_transfer_tx_args(eth_bridge_transfer_msg, wrapper_tx_msg)?;
        let (tx, signing_data) = build_bridge_pool_tx(&self.namada, args.clone()).await?;
        self.serialize_tx_result(tx, wrapper_tx_msg, signing_data)
    }

    pub async fn build_vote_proposal(
        &self,
        vote_proposal_msg: &[u8],
        wrapper_tx_msg: &[u8],
    ) -> Result<JsValue, JsError> {
        let args = args::vote_proposal_tx_args(vote_proposal_msg, wrapper_tx_msg)?;
        let epoch = query_epoch(self.namada.client()).await?;
        let (tx, signing_data) = build_vote_proposal(&self.namada, &args, epoch)
            .await
            .map_err(JsError::from)?;
        self.serialize_tx_result(tx, wrapper_tx_msg, signing_data)
    }

    pub async fn build_claim_rewards(
        &self,
        claim_rewards_msg: &[u8],
        wrapper_tx_msg: &[u8],
    ) -> Result<JsValue, JsError> {
        let args = args::claim_rewards_tx_args(claim_rewards_msg, wrapper_tx_msg)?;
        let (tx, signing_data) = build_claim_rewards(&self.namada, &args)
            .await
            .map_err(JsError::from)?;
        self.serialize_tx_result(tx, wrapper_tx_msg, signing_data)
    }

    pub async fn build_bond(
        &self,
        bond_msg: &[u8],
        wrapper_tx_msg: &[u8],
    ) -> Result<JsValue, JsError> {
        let args = args::bond_tx_args(bond_msg, wrapper_tx_msg)?;
        let (tx, signing_data) = build_bond(&self.namada, &args).await?;
        self.serialize_tx_result(tx, wrapper_tx_msg, signing_data)
    }

    /*
       Special function to build a pre-bond transaction for the genesis
    */
    pub async fn build_genesis_bond(
        &self,
        bond_msg: &[u8],
        wrapper_tx_msg: &[u8],
    ) -> Result<JsValue, JsError> {
        /// Get a dummy public key for a fee payer - there are no fees for genesis tx
        fn genesis_fee_payer_pk() -> common::PublicKey {
            common::SecretKey::Ed25519(ed25519::SigScheme::from_bytes([0; 32])).ref_to()
        }

        /// Dummy genesis fee token address - there are no fees for genesis tx
        fn genesis_fee_token_address() -> Address {
            Address::from(&genesis_fee_payer_pk())
        }

        // This could be optimized without using this generic function and only extracting the data we really need.
        // But I'm lazy
        let args = args::bond_tx_args(bond_msg, wrapper_tx_msg)?;

        let source = args.source;
        let validator = args.validator;

        // Genesis transactions are special, and they have some placeholder data in some fields.
        let mut tx = Tx::from_type(TxType::Raw);

        // Chain id is always "namada-genesis"
        tx.header.chain_id = ChainId("namada-genesis".into());

        // Timestamp is always 2001 - Nice date
        tx.header.timestamp = DateTimeUtc::from_unix_timestamp(
            // Mon Jan 01 2001 01:01:01 UTC+0000
            978310861,
        )
        .unwrap();

        // Code is always all 0
        tx.set_code(Code {
            salt: [0; 8],
            code: Commitment::Hash(Default::default()),
            tag: Some("tx_bond.wasm".to_string()),
        });

        // This is the bond data, we are going to serialize it. It's the only piece with real data of the whole transaction
        let data = pos::Bond {
            validator: validator.clone(),
            amount: args.amount,
            source: source.clone(),
        };

        // serialization stuff
        tx.set_data(Data {
            salt: [0; 8],
            data: data.serialize_to_vec(),
        });

        // Fee payer is always the genesis fee payer (empty pub key)
        let fee_payer = genesis_fee_payer_pk();
        tx.add_wrapper(
            Fee {
                amount_per_gas_unit: DenominatedAmount::native(0.into()),
                token: genesis_fee_token_address(),
            },
            fee_payer,
            0.into(),
        );

        // for now we are supporting only regular accounts - no multisig
        let pks = args.tx.signing_keys.clone();
        let signing_data = SigningTxData {
            owner: source.clone(),
            account_public_keys_map: Some(pks.iter().cloned().collect()),
            public_keys: pks.clone(),
            threshold: 1u8,
            fee_payer: genesis_fee_payer_pk(),
        };

        self.serialize_tx_result(tx, wrapper_tx_msg, signing_data)
    }

    pub async fn build_unbond(
        &self,
        unbond_msg: &[u8],
        wrapper_tx_msg: &[u8],
    ) -> Result<JsValue, JsError> {
        let args = args::unbond_tx_args(unbond_msg, wrapper_tx_msg)?;
        let (tx, signing_data, _) = build_unbond(&self.namada, &args).await?;
        self.serialize_tx_result(tx, wrapper_tx_msg, signing_data)
    }

    pub async fn build_withdraw(
        &self,
        withdraw_msg: &[u8],
        wrapper_tx_msg: &[u8],
    ) -> Result<JsValue, JsError> {
        let args = args::withdraw_tx_args(withdraw_msg, wrapper_tx_msg)?;
        let (tx, signing_data) = build_withdraw(&self.namada, &args).await?;
        self.serialize_tx_result(tx, wrapper_tx_msg, signing_data)
    }

    pub async fn build_redelegate(
        &self,
        redelegate_msg: &[u8],
        wrapper_tx_msg: &[u8],
    ) -> Result<JsValue, JsError> {
        let args = args::redelegate_tx_args(redelegate_msg, wrapper_tx_msg)?;
        let (tx, signing_data) = build_redelegation(&self.namada, &args).await?;
        self.serialize_tx_result(tx, wrapper_tx_msg, signing_data)
    }

    pub async fn build_reveal_pk(&self, wrapper_tx_msg: &[u8]) -> Result<JsValue, JsError> {
        let args = args::tx_args_from_slice(wrapper_tx_msg)?;
        let public_key = args.signing_keys[0].clone();
        let (tx, signing_data) = build_reveal_pk(&self.namada, &args.clone(), &public_key).await?;
        self.serialize_tx_result(tx, wrapper_tx_msg, signing_data)
    }

    // Sign arbitrary data with the provided signing key
    pub fn sign_arbitrary(&self, signing_key: String, data: String) -> Result<JsValue, JsError> {
        let hash = Hash::sha256(&data);
        let secret = common::SecretKey::Ed25519(ed25519::SecretKey::from_str(&signing_key)?);
        let signature = common::SigScheme::sign(&secret, &hash);
        let sig_bytes = signature.to_bytes();

        to_js_result((hash.to_string().to_lowercase(), hex::encode(sig_bytes)))
    }

    // Verify signed arbitrary data
    pub fn verify_arbitrary(
        &self,
        public_key: String,
        signed_hash: String,
        signature: String,
    ) -> Result<JsValue, JsError> {
        let public_key = common::PublicKey::from_str(&public_key)?;
        let sig = common::Signature::try_from_slice(&hex::decode(&signature)?)?;
        let signed_hash = Hash::from_str(&signed_hash)?;
        let result = common::SigScheme::verify_signature(&public_key, &signed_hash, &sig)?;

        to_js_result(result)
    }

    fn serialize_tx_result(
        &self,
        tx: Tx,
        wrapper_tx_msg: &[u8],
        signing_data: SigningTxData,
    ) -> Result<JsValue, JsError> {
        let tx = tx::Tx::new(tx, wrapper_tx_msg, vec![signing_data])?;
        to_js_result(borsh::to_vec(&tx)?)
    }
}

#[wasm_bindgen(module = "/src/sdk/mod.js")]
extern "C" {
    #[wasm_bindgen(catch, js_name = "getMaspParams")]
    async fn get_masp_params() -> Result<JsValue, JsValue>;
    #[wasm_bindgen(catch, js_name = "hasMaspParams")]
    async fn has_masp_params() -> Result<JsValue, JsValue>;
    #[wasm_bindgen(catch, js_name = "fetchAndStoreMaspParams")]
    async fn fetch_and_store_masp_params() -> Result<JsValue, JsValue>;
}