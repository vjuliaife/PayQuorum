import type { Address } from "viem";
import { BaseAgent } from "./base-agent";
import { AgentRole, type AgentConfig, type SubTask } from "./types";
import { config } from "../config";
import { AgentEscrowABI } from "../blockchain";

/**
 * ValidatorAgent — Verifies compute output quality and triggers escrow release.
 * Multi-criteria scoring system (100-point scale, 60 threshold).
 * On approval: calls AgentEscrow.releaseToExecutor() on-chain.
 */
export class ValidatorAgent extends BaseAgent {
  private validationCount = 0;
  private approvedCount = 0;
  private rejectedCount = 0;

  constructor(agentConfig: AgentConfig) {
    super({ ...agentConfig, role: AgentRole.Validator });
  }

  async initialize(): Promise<void> {
    this.log(`Initialized at ${this.address}`);
    this.emit("agent:initialized", { role: this.role, address: this.address });
  }

  async executeSubtask(
    subtask: SubTask,
    computeResult: unknown,
  ): Promise<{ approved: boolean; score: number; checks: Array<{ name: string; passed: boolean; weight: number }> }> {
    this.log(`Validating: ${subtask.id}`);
    this.validationCount++;

    const result = computeResult as {
      summary: string;
      computeUnits: number;
      results: unknown[];
      confidence: number;
    };

    const checks = [
      { name: "results_present", passed: Array.isArray(result.results) && result.results.length > 0, weight: 30 },
      { name: "confidence_above_threshold", passed: result.confidence > 0.5, weight: 25 },
      { name: "compute_units_reasonable", passed: result.computeUnits > 0 && result.computeUnits < 100, weight: 20 },
      { name: "summary_present", passed: typeof result.summary === "string" && result.summary.length > 0, weight: 15 },
      { name: "no_empty_results", passed: result.results?.every((r) => r !== null && r !== undefined) ?? false, weight: 10 },
    ];

    const score = checks.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0);
    const approved = score >= 60;

    if (approved) {
      this.approvedCount++;
      this.log(`APPROVED (score: ${score}/100)`);
    } else {
      this.rejectedCount++;
      this.log(`REJECTED (score: ${score}/100)`);
    }

    this.emit("agent:action", {
      action: approved ? "validation_approved" : "validation_rejected",
      taskId: subtask.parentTaskId, subtaskId: subtask.id,
      score, checks: checks.map(c => ({ name: c.name, passed: c.passed })),
    });

    // Record validation payment
    this.recordPayment({
      from: "escrow", to: this.address,
      amount: subtask.payment, taskId: subtask.parentTaskId,
      subtaskId: subtask.id, timestamp: Date.now(),
      type: "nanopayment",
    });

    return { approved, score, checks };
  }

  async releaseEscrow(taskId: number, executorAddress: Address, amount: bigint): Promise<string | null> {
    if (!config.contracts.agentEscrow) {
      this.log("Escrow contract not deployed — skipping on-chain release");
      this.emit("escrow:released", { taskId, executor: executorAddress.slice(0, 12), amount: Number(amount) / 1e6, onChain: false });
      return null;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (this.walletClient as any).writeContract({
        address: config.contracts.agentEscrow,
        abi: AgentEscrowABI,
        functionName: "releaseToExecutor",
        args: [BigInt(taskId)],
      });
      this.log(`Escrow released: ${tx}`);

      this.recordPayment({
        from: config.contracts.agentEscrow, to: executorAddress,
        amount, taskId, subtaskId: "escrow_release",
        timestamp: Date.now(), txHash: tx, type: "escrow_release",
      });

      this.emit("escrow:released", { taskId, executor: executorAddress.slice(0, 12), amount: Number(amount) / 1e6, tx, onChain: true });
      this.emit("reputation:updated", { agent: executorAddress.slice(0, 12), taskId, success: true });

      return tx;
    } catch (error) {
      this.log(`Escrow release failed: ${error}`);
      this.emit("escrow:released", { taskId, amount: Number(amount) / 1e6, onChain: false, error: String(error) });
      return null;
    }
  }

  override getStats() {
    return {
      ...super.getStats(),
      validationCount: this.validationCount,
      approvedCount: this.approvedCount,
      rejectedCount: this.rejectedCount,
      approvalRate: this.validationCount > 0
        ? `${((this.approvedCount / this.validationCount) * 100).toFixed(1)}%`
        : "N/A",
    };
  }
}
