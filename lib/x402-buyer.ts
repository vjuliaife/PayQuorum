/**
 * x402 Buyer — Enables agents to pay for x402-gated APIs.
 *
 * Uses @x402/fetch (npm v2.10.0) for automatic 402 payment handling.
 * Uses @circle-fin/x402-batching (npm v2.1.0) for gasless Circle Nanopayments.
 *
 * SDK: https://github.com/x402-foundation/x402
 */
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { config } from "./config";

/**
 * Wraps native fetch with automatic x402 payment handling.
 * When a 402 is received, signs EIP-3009 USDC authorization and retries.
 */
export function createX402Fetch(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  return wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [
      {
        network: config.x402Network,
        client: new ExactEvmScheme(account),
      },
    ],
  });
}

/**
 * Circle Gateway client for gasless batched Nanopayments.
 * deposit() once, then pay() is gasless — Circle batches settlement.
 */
export function createGatewayBuyer(privateKey: `0x${string}`): GatewayClient {
  return new GatewayClient({
    chain: "arcTestnet",
    privateKey,
  });
}
