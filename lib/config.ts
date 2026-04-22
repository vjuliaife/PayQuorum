import { defineChain } from "viem";

/**
 * Arc Testnet chain definition.
 * Verified: https://docs.arc.network/arc/references/connect-to-arc
 *
 * USDC is the native gas token on Arc (dual interface):
 *   Native: 18 decimals (gas, getBalance)
 *   ERC-20: 6 decimals (precompile at 0x360000...0000)
 */
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

/**
 * Verified contract addresses on Arc Testnet.
 * Source: https://docs.arc.network/arc/references/contract-addresses
 */
export const KNOWN_ADDRESSES = {
  usdc: "0x3600000000000000000000000000000000000000" as const,
  gatewayWallet: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as const,
  gatewayMinter: "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B" as const,
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const,
} as const;

export const config = {
  arc: arcTestnet,
  rpc: process.env.ARC_TESTNET_RPC || "https://rpc.testnet.arc.network",
  chainId: 5042002,
  x402Network: "eip155:5042002" as const,
  x402FacilitatorUrl: process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator",

  contracts: {
    usdc: (process.env.USDC_ADDRESS || KNOWN_ADDRESSES.usdc) as `0x${string}`,
    taskRegistry: process.env.TASK_REGISTRY_ADDRESS as `0x${string}` | undefined,
    agentEscrow: process.env.AGENT_ESCROW_ADDRESS as `0x${string}` | undefined,
    reputation: process.env.REPUTATION_ADDRESS as `0x${string}` | undefined,
    budgetController: process.env.BUDGET_CONTROLLER_ADDRESS as `0x${string}` | undefined,
  },

  agents: {
    orchestrator: process.env.ORCHESTRATOR_PRIVATE_KEY as `0x${string}` | undefined,
    dataAgent: process.env.DATA_AGENT_PRIVATE_KEY as `0x${string}` | undefined,
    computeAgent: process.env.COMPUTE_AGENT_PRIVATE_KEY as `0x${string}` | undefined,
    validator: process.env.VALIDATOR_PRIVATE_KEY as `0x${string}` | undefined,
    treasury: process.env.TREASURY_PRIVATE_KEY as `0x${string}` | undefined,
  },

  aisaApiKey: process.env.AISA_API_KEY,
  aisaBaseUrl: "https://api.aisa.one/apis/v1",

  // Gemini (Google DeepMind) — free key from https://aistudio.google.com
  geminiApiKey: process.env.GEMINI_API_KEY,

  // Featherless AI — OpenAI-compatible, https://featherless.ai
  featherlessApiKey: process.env.FEATHERLESS_API_KEY,
  featherlessBaseUrl: "https://api.featherless.ai/v1",
} as const;
