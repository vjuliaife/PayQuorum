import type { Address } from "viem";
import { BaseAgent } from "./base-agent";
import { AgentRole, type AgentConfig, type PaymentRecord } from "./types";
import { config } from "../config";
import { BudgetControllerABI } from "../blockchain";

/**
 * TreasuryAgent — Monitors all agent spending and enforces budgets.
 * Calls BudgetController.canSpend() on-chain before authorizing payments.
 * Maintains a full audit trail of all system transactions.
 */
export class TreasuryAgent extends BaseAgent {
  private allPayments: PaymentRecord[] = [];
  private totalSystemSpend = 0n;
  private alerts: Array<{ type: string; message: string; timestamp: number }> = [];

  constructor(agentConfig: AgentConfig) {
    super({ ...agentConfig, role: AgentRole.Treasury });
  }

  async initialize(): Promise<void> {
    this.log(`Initialized at ${this.address}`);
    this.emit("agent:initialized", { role: this.role, address: this.address });
  }

  trackPayment(payment: PaymentRecord): void {
    this.allPayments.push(payment);
    this.totalSystemSpend += payment.amount;

    this.emit("budget:recorded", {
      from: typeof payment.from === "string" ? payment.from.slice(0, 12) : payment.from,
      amount: Number(payment.amount) / 1e6,
      type: payment.type,
      taskId: payment.taskId,
      systemTotal: Number(this.totalSystemSpend) / 1e6,
    });
  }

  async canAuthorizeSpend(agentAddress: Address, amount: bigint): Promise<boolean> {
    if (!config.contracts.budgetController) {
      return true;
    }

    try {
      const canSpend = await this.publicClient.readContract({
        address: config.contracts.budgetController,
        abi: BudgetControllerABI,
        functionName: "canSpend",
        args: [agentAddress, amount],
      });

      if (!canSpend) {
        this.alerts.push({
          type: "BUDGET_EXCEEDED",
          message: `Agent ${agentAddress.slice(0, 12)} denied: ${Number(amount) / 1e6} USDC exceeds limit`,
          timestamp: Date.now(),
        });
        this.emit("budget:denied", { agent: agentAddress.slice(0, 12), amount: Number(amount) / 1e6 });
      }

      return canSpend as boolean;
    } catch {
      return true;
    }
  }

  /**
   * Record spending on-chain via BudgetController.recordSpending().
   * This is a real on-chain transaction that produces a tx hash.
   */
  async recordSpendingOnChain(agentAddress: Address, amount: bigint): Promise<string | null> {
    if (!config.contracts.budgetController) return null;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (this.walletClient as any).writeContract({
        address: config.contracts.budgetController,
        abi: BudgetControllerABI,
        functionName: "recordSpending",
        args: [agentAddress, amount],
      });

      this.emit("budget:recorded", {
        agent: agentAddress.slice(0, 12),
        amount: Number(amount) / 1e6,
        tx,
        onChain: true,
      });

      return tx;
    } catch (error) {
      this.log(`On-chain recordSpending failed: ${error}`);
      return null;
    }
  }

  getAuditSummary() {
    const byAgent: Record<string, { spent: number; txCount: number }> = {};
    const byType: Record<string, { total: number; count: number }> = {};

    for (const p of this.allPayments) {
      const key = typeof p.from === "string" ? p.from.slice(0, 12) : "unknown";
      if (!byAgent[key]) byAgent[key] = { spent: 0, txCount: 0 };
      byAgent[key].spent += Number(p.amount) / 1e6;
      byAgent[key].txCount++;

      if (!byType[p.type]) byType[p.type] = { total: 0, count: 0 };
      byType[p.type].total += Number(p.amount) / 1e6;
      byType[p.type].count++;
    }

    return {
      totalSystemSpend: Number(this.totalSystemSpend) / 1e6,
      totalTransactions: this.allPayments.length,
      byAgent,
      byType,
      alerts: this.alerts,
    };
  }

  override getStats() {
    return {
      ...super.getStats(),
      totalSystemSpend: Number(this.totalSystemSpend) / 1e6,
      totalTransactions: this.allPayments.length,
      alertCount: this.alerts.length,
    };
  }
}
