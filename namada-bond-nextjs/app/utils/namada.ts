import initSdk from "../packages/sdk/src/initInline";
import { getSdk } from "../packages/sdk/src/indexWeb";
import { Sdk } from "../packages/sdk/src/sdk";

export async function getSdkInstance(): Promise<Sdk> {
  const { cryptoMemory } = await initSdk();

  const sdk = getSdk(
    cryptoMemory,
    "https://rpc.namada.tududes.com", // I don't really understand why we are forced to set an RPC even if we are not using it..
    "",
    "tnam1qqzywyugkgpp9ptl3702ld8k79lv0memlurnh2hh"
  );
  return sdk;
}
