import React, { useCallback, useContext, useEffect, useState } from "react";
import BigNumber from "bignumber.js";
import { Account, BondProps, TxProps } from "../types";
import { shortenAddress } from "../utils";
import { AppContext } from "./App";

// MUI components
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Alert,
  Typography,
} from "@mui/material";

const KINTSUGI_ADDR = "tnam1qydvhqdu2q2vrgvju2ngpt6yhrehu525pus6m28p";

interface GenesisBondFormProps {
  accounts: Account[];
  validators: { label: string; value: string }[];
}

export const GenesisBondForm: React.FC<GenesisBondFormProps> = ({
  accounts,
  validators,
}) => {
  const { integration } = useContext(AppContext)!;

  const accountLookup = accounts.reduce((acc, account) => {
    acc[account.address] = account;
    return acc;
  }, {} as Record<string, Account>);

  const [account, setAccount] = useState<Account>(accounts[0]);
  const [loading, setLoading] = useState(false);
  const [editingBonds, setEditingBonds] = useState(false);
  const [previousBonds, setPreviousBonds] = useState<
    { source: string; validator: string; amount: string }[]
  >([]);

  const [validator, setValidator] = useState<string>(KINTSUGI_ADDR);
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [bonds, setBonds] = useState<any[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [automatic, setAutomatic] = useState(true);
  const [tip, setTip] = useState(false);

  const [success, setSuccess] = useState<string>();
  const [error, setError] = useState<string>();
  const [disablingError, setDisablingError] = useState<
    React.ReactNode | undefined
  >();

  const accountsSelectData = accounts.map(({ alias, address }) => ({
    label: `${alias} - ${shortenAddress(address)}`,
    value: address,
  }));

  useEffect(() => {
    const getBalance = async () => {
      try {
        const res = await fetch(
          `${
            process.env.NAMADA_INTERFACE_GENESIS_API_URL ??
            "http://127.0.0.1:3000"
          }/balance/${account.address}`
        );

        if (res.ok) {
          const b = (await res.json()) as { balance: string };
          setDisablingError(undefined);
          setBalance(parseFloat(b.balance));
        } else {
          if (res.status === 404) {
            setDisablingError(
              <Typography variant="body1">
                We can't find a genesis balance for this account. Please make
                sure you claimed your airdrop back in the days.
              </Typography>
            );
          }
        }
      } catch (e) {
        console.error(e);
      }

      setError(undefined);
    };

    getBalance();
  }, [account]);

  useEffect(() => {
    const checkSubmission = async () => {
      try {
        const res = await fetch(
          `${
            process.env.NAMADA_INTERFACE_GENESIS_API_URL ??
            "http://127.0.0.1:3000"
          }/bonds/${account.publicKey ?? ""}`
        );

        if (res.ok) {
          const bondData = (await res.json()) as {
            bonds: { source: string; validator: string; amount: string }[];
          };

          setPreviousBonds(bondData.bonds);
        } else {
          setPreviousBonds([]);
        }
      } catch (e) {
        console.error(e);
      }
    };

    checkSubmission();
  }, [account]);

  useEffect(() => {
    setSuccess(undefined);
    setError(undefined);
    setBonds([]);
  }, [automatic]);

  useEffect(() => {
    // Set validator at page load if default is provided
    if (typeof window !== "undefined") {
      const queryString = window.location.search;
      const urlParams = new URLSearchParams(queryString);
      if (urlParams.has("validator")) {
        setValidator(urlParams.get("validator")!);
      } else if (validators.length > 0) {
        setValidator(validators[0].value);
      }
    }
  }, [validators]);

  const handleSubmit = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setError(undefined);
      setSuccess(undefined);

      if (!account || !validator || !amount) {
        console.log(account, validator, amount);
        setError("Please provide the required values!");
        return;
      }

      setLoading(true);
      try {
        // Calculate amounts
        let regular_amount = tip ? Math.ceil(amount * 0.8) : amount;
        let tip_amount = tip ? amount - regular_amount : 0;

        // Init SDK
        let { tx } = await getSdkInstance();
        const txs: TxProps[] = [];
        let bondProps: BondProps[] = [];

        // Prepare tx
        bondProps.push({
          source: account.address,
          validator: validator,
          amount: new BigNumber(regular_amount),
        });

        txs.push(await getBondTx(tx, bondProps[0], account));

        // Prepare tip tx
        if (tip_amount > 0) {
          bondProps.push({
            source: account.address,
            validator: KINTSUGI_ADDR,
            amount: new BigNumber(tip_amount),
          });

          txs.push(await getBondTx(tx, bondProps[1], account));
        }

        // genesis checksums are placeholder
        const checksums: Record<string, string> = {
          "tx_bond.wasm":
            "0000000000000000000000000000000000000000000000000000000000000000",
        };

        let signer = integration.signer();

        let result = await signer?.sign(txs, account.address, checksums);

        if (!result) {
          console.error("No result from signing");
          setError("Error: No result from signing");
          return;
        }

        let bonds: any[] = [];
        let i = 0;
        for (const res of result) {
          let signResponse = await tx.getTxSignature(
            res,
            account.publicKey ?? ""
          );

          bonds.push({
            ...bondProps[i],
            source: account.publicKey ?? "",
            signatures: signResponse.signatures,
          });
          i++;
        }

        if (automatic) {
          // Submit bonds to api
          const response = await fetch(
            `${
              process.env.NAMADA_INTERFACE_GENESIS_API_URL ??
              "http://127.0.0.1:3000"
            }/submit_bond`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ bonds: bonds }),
            }
          );

          if (response.ok) {
            setSuccess(
              "Your bond transaction has been successfully submitted to be included in the genesis. You will see it reflected in the GitHub repository automatically shortly."
            );
            setLoading(false);
          } else {
            let errorInfo = await response.json();
            let errorMessage = "";

            if (errorInfo.errors) {
              errorMessage = errorInfo.errors.map((e: any) => e.msg).join(", ");
              throw new Error(`${errorMessage}`);
            } else {
              throw new Error(
                `Unable to submit bond transaction to API ${response.status}`
              );
            }
          }
          return;
        } else {
          setBonds(bonds);
          setSuccess(
            "Your bond transaction has been signed correctly! Please copy paste the signed bond.toml from the below box, and open a pull request on GitHub yourself following this guide."
          );
          setLoading(false);
        }
      } catch (e) {
        if (e instanceof Error) {
          if (e.message.includes("does not match Tx header chain_id")) {
            setError(`CHAIN_ID_MISMATCH`);
          } else {
            setError(`Unable to sign transaction. ${e.message}`);
          }
        } else {
          setError(`Unable to sign transaction. Unknown error`);
        }
        setLoading(false);
      }
    },
    [account, validator, amount, tip, automatic, integration]
  );

  return (
    <Box component="form">
      <FormControl fullWidth margin="normal">
        {accounts.length > 0 ? (
          <>
            <InputLabel id="account-select-label">Account</InputLabel>
            <Select
              labelId="account-select-label"
              value={account.address}
              label="Account"
              onChange={(e) =>
                setAccount(accountLookup[e.target.value as string])
              }
            >
              {accountsSelectData.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </>
        ) : (
          <Typography variant="body1">
            You have no signing accounts! Import or create an account in the
            extension, then reload this page.
          </Typography>
        )}
        {disablingError && (
          <FormHelperText error>{disablingError}</FormHelperText>
        )}
      </FormControl>

      {!disablingError ? (
        previousBonds.length === 0 || editingBonds ? (
          <>
            <FormControl fullWidth margin="normal">
              <InputLabel id="validator-select-label">Validator</InputLabel>
              <Select
                labelId="validator-select-label"
                value={validator}
                label="Validator"
                onChange={(e) => setValidator(e.target.value)}
              >
                {validators.map((v) => (
                  <MenuItem key={v.value} value={v.value}>
                    {v.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth margin="normal">
              <TextField
                label="Amount"
                type="number"
                placeholder="100 NAM"
                value={amount !== undefined ? amount : ""}
                onChange={(e) => setAmount(parseFloat(e.target.value))}
                InputProps={{ inputProps: { min: 0, step: 0.001 } }}
                error={amount !== undefined && amount > balance}
                helperText={`Genesis Balance: ${balance.toFixed(2)} NAM`}
              />
            </FormControl>

            <FormControlLabel
              control={
                <Checkbox
                  checked={automatic}
                  onChange={() => setAutomatic(!automatic)}
                />
              }
              label="Enable automatic submission of signature (no PR on GitHub needed)"
              sx={{ marginY: 1 }}
            />

            {validator !== KINTSUGI_ADDR && (
              <FormControlLabel
                control={
                  <Checkbox checked={tip} onChange={() => setTip(!tip)} />
                }
                label={
                  <>
                    Delegate 20% also to{" "}
                    <a
                      href="https://kintsugi.tech"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Kintsugi Validator
                    </a>{" "}
                    - as a thank for building this interface
                  </>
                }
                sx={{ marginY: 1 }}
              />
            )}
          </>
        ) : (
          <Box paddingY={2}>
            <Typography variant="body1">
              It looks like you already submitted a bond!
            </Typography>
            <Typography variant="body1" fontWeight="bold" marginTop={2}>
              Current Bonds:
            </Typography>
            {previousBonds.map((b, idx) => {
              let valName = validators.find((v) => v.value === b.validator);
              return (
                <Typography key={idx} variant="body2">
                  {valName?.label}: {b.amount} NAM
                </Typography>
              );
            })}
          </Box>
        )
      ) : (
        <Typography variant="body1">{disablingError}</Typography>
      )}

      {error && (
        <Alert severity="error" sx={{ marginTop: 2 }}>
          {error === "CHAIN_ID_MISMATCH" ? (
            <>
              Unable to sign transaction. Please make sure to configure the
              correct chain id (namada-genesis) in namada extension. Check{" "}
              <a
                href="https://namada-genesis.kintsugi-nodes.com/chain-setting.gif"
                target="_blank"
                rel="noopener noreferrer"
              >
                here
              </a>{" "}
              for more info.
            </>
          ) : (
            error
          )}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ marginTop: 2 }}>
          {success}
        </Alert>
      )}

      {loading && (
        <Alert severity="info" sx={{ marginTop: 2, textAlign: "center" }}>
          <CircularProgress size={20} sx={{ marginRight: 1 }} />
          Signing transaction...
        </Alert>
      )}

      {bonds.length > 0 && (
        <Box marginTop={4}>
          <Typography variant="subtitle1" gutterBottom>
            signed-bond.toml
          </Typography>
          <Box
            sx={{
              width: "100%",
              marginTop: 1,
              fontFamily: "Monospace",
              overflowWrap: "break-word",
              border: "1px solid rgba(0, 0, 0, 0.23)",
              borderRadius: 1,
              padding: 2,
            }}
          >
            {bonds.map((bond, i) => (
              <React.Fragment key={i}>
                {i > 0 && <br />}
                [[bond]] <br />
                source = "{bond.source}"
                <br />
                validator = "{bond.validator}" <br />
                amount = "{bond.amount.toString()}" <br />
                <br />
                [bond.signatures]
                <br />
                {bond.signatures.map((s: any, idx: number) => (
                  <React.Fragment key={idx}>
                    {s.pub_key} = "{s.signature}"
                    <br />
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
          </Box>
        </Box>
      )}

      <Box marginTop={2} textAlign="center">
        <Button
          variant="contained"
          color="primary"
          onClick={(e) => {
            if (previousBonds.length > 0 && !editingBonds) {
              setEditingBonds(true);
            } else {
              handleSubmit(e);
            }
          }}
          disabled={loading || disablingError !== undefined}
        >
          {previousBonds.length > 0 ? "Edit Bonds" : "Sign Bond"}
        </Button>
      </Box>
    </Box>
  );
};
