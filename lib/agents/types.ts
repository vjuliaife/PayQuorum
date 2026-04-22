import type { Address } from "viem";

export enum AgentRole {
  Orchestrator = "orchestrator",
  Data = "data",
  Compute = "compute",
  Validator = "validator",
  Treasury = "treasury",
}

export interface AgentConfig {
  role: AgentRole;
  name: string;
  privateKey?: `0x${string}`;
  capabilities: string[];
  costPerAction: bigint; // USDC 6-decimal
}

export interface Task {
  id: number;
  description: string;
  bounty: bigint;
  subtasks: SubTask[];
  status: "pending" | "decomposed" | "in_progress" | "completed" | "failed";
}

export interface SubTask {
  id: string;
  parentTaskId: number;
  type: "data_fetch" | "compute" | "validate";
  description: string;
  requiredCapability: string;
  assignedAgent?: Address;
  result?: unknown;
  status: "pending" | "assigned" | "completed" | "failed";
  payment: bigint;
}

export interface PaymentRecord {
  from: string;
  to: string;
  amount: bigint;
  taskId: number;
  subtaskId: string;
  timestamp: number;
  txHash?: string;
  type: "escrow_lock" | "x402_payment" | "escrow_release" | "nanopayment" | "compute_fee";
}

export interface CycleResult {
  taskId: number;
  query: string;
  bounty: string;
  subtaskCount: number;
  dataSourcesQueried: number;
  computeUnitsUsed: number;
  validationScore: number;
  approved: boolean;
  paymentsGenerated: number;
  durationMs: number;
}
