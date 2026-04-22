import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config, arcTestnet } from "./config";

// Real ABIs extracted from Hardhat compilation artifacts
import TaskRegistryABI from "./abi/TaskRegistry.json";
import AgentEscrowABI from "./abi/AgentEscrow.json";
import ReputationABI from "./abi/Reputation.json";
import BudgetControllerABI from "./abi/BudgetController.json";

export { TaskRegistryABI, AgentEscrowABI, ReputationABI, BudgetControllerABI };

export const ERC20_ABI = [
  {
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export function getPublicClient(): PublicClient {
  return createPublicClient({
    chain: arcTestnet as unknown as Chain,
    transport: http(config.rpc),
  });
}

export function getWalletClient(privateKey: `0x${string}`): WalletClient {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain: arcTestnet as unknown as Chain,
    transport: http(config.rpc),
  });
}

export function formatUSDC(amount: bigint): string {
  const whole = amount / 1_000_000n;
  const frac = (amount % 1_000_000n).toString().padStart(6, "0");
  return `${whole}.${frac}`;
}

export function parseUSDC(amount: string): bigint {
  const cleaned = amount.replace("$", "").trim();
  const [whole, frac = ""] = cleaned.split(".");
  const paddedFrac = frac.padEnd(6, "0").slice(0, 6);
  return BigInt(whole || "0") * 1_000_000n + BigInt(paddedFrac);
}
