import { OrchestratorAgent } from "./orchestrator";
import { DataAgent } from "./data-agent";
import { ComputeAgent } from "./compute-agent";
import { ValidatorAgent } from "./validator-agent";
import { TreasuryAgent } from "./treasury-agent";
import { AgentRole, type CycleResult, type PaymentRecord } from "./types";
import { emitEvent } from "../events";
import { config } from "../config";
import { AgentEscrowABI, TaskRegistryABI } from "../blockchain";

const DEMO_QUERIES = [
  "Analyze AAPL financial metrics and analyst sentiment",
  "Evaluate NVDA stock performance and insider activity",
  "Compare MSFT income trends with sector benchmarks",
  "Assess GOOGL revenue growth and market positioning",
  "Review AMZN financial health and price momentum",
  "Analyze TSLA valuation metrics and analyst coverage",
  "Evaluate META advertising revenue and user metrics",
  "Compare AMD vs INTC financial performance",
  "Assess JPM banking sector outlook and earnings",
  "Review DIS streaming metrics and revenue diversification",
  "Analyze NFLX subscriber growth and content investment",
  "Evaluate CRM enterprise software market position",
];

let pipeline: AgentPipeline | null = null;

export class AgentPipeline {
  private orchestrator: OrchestratorAgent;
  private dataAgent: DataAgent;
  private computeAgent: ComputeAgent;
  private validator: ValidatorAgent;
  private treasury: TreasuryAgent;
  private cycleResults: CycleResult[] = [];
  private running = false;

  constructor() {
    this.orchestrator = new OrchestratorAgent({
      role: AgentRole.Orchestrator, name: "Orchestrator",
      privateKey: process.env.ORCHESTRATOR_PRIVATE_KEY as `0x${string}` | undefined,
      capabilities: ["task_decomposition", "agent_selection"], costPerAction: 0n,
    });
    this.dataAgent = new DataAgent({
      role: AgentRole.Data, name: "DataAgent",
      privateKey: process.env.DATA_AGENT_PRIVATE_KEY as `0x${string}` | undefined,
      capabilities: ["data_fetch", "api_query"], costPerAction: 5000n,
    });
    this.computeAgent = new ComputeAgent({
      role: AgentRole.Compute, name: "ComputeAgent",
      privateKey: process.env.COMPUTE_AGENT_PRIVATE_KEY as `0x${string}` | undefined,
      capabilities: ["data_processing", "analysis"], costPerAction: 2000n,
    });
    this.validator = new ValidatorAgent({
      role: AgentRole.Validator, name: "ValidatorAgent",
      privateKey: process.env.VALIDATOR_PRIVATE_KEY as `0x${string}` | undefined,
      capabilities: ["quality_check", "escrow_release"], costPerAction: 1000n,
    });
    this.treasury = new TreasuryAgent({
      role: AgentRole.Treasury, name: "TreasuryAgent",
      privateKey: process.env.TREASURY_PRIVATE_KEY as `0x${string}` | undefined,
      capabilities: ["budget_monitoring", "audit"], costPerAction: 0n,
    });
  }

  async initialize(): Promise<void> {
    await Promise.all([
      this.orchestrator.initialize(),
      this.dataAgent.initialize(),
      this.computeAgent.initialize(),
      this.validator.initialize(),
      this.treasury.initialize(),
    ]);

    this.orchestrator.registerAgent(AgentRole.Data, this.dataAgent.address);
    this.orchestrator.registerAgent(AgentRole.Compute, this.computeAgent.address);
    this.orchestrator.registerAgent(AgentRole.Validator, this.validator.address);

    // Wire payment tracking
    const trackAll = (record: PaymentRecord) => this.treasury.trackPayment(record);
    // Collect from all agents on each cycle
    this._trackFn = trackAll;
  }

  private _trackFn: ((r: PaymentRecord) => void) | null = null;

  async runTaskCycle(query: string, bounty: bigint): Promise<CycleResult> {
    const start = Date.now();

    // 1. Orchestrator creates task on-chain (USDC.approve + TaskRegistry.createTask)
    const task = await this.orchestrator.submitTask(query, bounty);
    await this.orchestrator.assignSubtasks(task);

    // 2. On-chain: Record escrow + bid + assign
    if (config.contracts.agentEscrow && config.contracts.taskRegistry) {
      try {
        // Record escrow entry
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const escrowTx = await (this.orchestrator.walletClient as any).writeContract({
          address: config.contracts.agentEscrow,
          abi: AgentEscrowABI,
          functionName: "recordEscrow",
          args: [BigInt(task.id), this.orchestrator.address, bounty],
        });
        await this.orchestrator.publicClient.waitForTransactionReceipt({ hash: escrowTx });
        emitEvent("escrow:locked", { taskId: task.id, amount: Number(bounty) / 1e6, tx: escrowTx });

        // Data agent places bid
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bidTx = await (this.dataAgent.walletClient as any).writeContract({
          address: config.contracts.taskRegistry,
          abi: TaskRegistryABI,
          functionName: "placeBid",
          args: [BigInt(task.id), bounty, `Data fetch for: ${query.slice(0, 50)}`],
        });
        await this.dataAgent.publicClient.waitForTransactionReceipt({ hash: bidTx });
        emitEvent("task:bid", { taskId: task.id, bidder: this.dataAgent.address.slice(0, 12), tx: bidTx });

        // Orchestrator assigns task to data agent
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const assignTx = await (this.orchestrator.walletClient as any).writeContract({
          address: config.contracts.taskRegistry,
          abi: TaskRegistryABI,
          functionName: "assignTask",
          args: [BigInt(task.id), this.dataAgent.address],
        });
        await this.orchestrator.publicClient.waitForTransactionReceipt({ hash: assignTx });
        emitEvent("task:assigned", { taskId: task.id, assignee: this.dataAgent.address.slice(0, 12), tx: assignTx });

        // Set assignee in escrow
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const setAssigneeTx = await (this.orchestrator.walletClient as any).writeContract({
          address: config.contracts.agentEscrow,
          abi: AgentEscrowABI,
          functionName: "setAssignee",
          args: [BigInt(task.id), this.dataAgent.address],
        });
        await this.orchestrator.publicClient.waitForTransactionReceipt({ hash: setAssigneeTx });
        emitEvent("agent:action", { action: "escrow_assignee_set", taskId: task.id, tx: setAssigneeTx });
      } catch (error) {
        const msg = String(error).slice(0, 200);
        console.error(`On-chain bid/assign failed for task ${task.id}: ${msg}`);
        emitEvent("agent:action", { action: "onchain_error", taskId: task.id, error: msg });
      }
    }

    // 3. Data Agent fetches real data from AIsa APIs
    const dataSubtask = task.subtasks.find(s => s.type === "data_fetch")!;
    const rawData = await this.dataAgent.executeSubtask(dataSubtask);

    for (const p of this.dataAgent.getPayments().slice(-3)) {
      this._trackFn?.(p);
    }

    // 4. Compute Agent processes data
    const computeSubtask = task.subtasks.find(s => s.type === "compute")!;
    const computeResult = await this.computeAgent.executeSubtask(computeSubtask, rawData);

    for (const p of this.computeAgent.getPayments().slice(-3)) {
      this._trackFn?.(p);
    }

    // 5. Validator checks quality
    const validateSubtask = task.subtasks.find(s => s.type === "validate")!;
    const validation = await this.validator.executeSubtask(validateSubtask, computeResult);

    // 6. On-chain: Escrow release (validator calls releaseToExecutor which also
    //    triggers TaskRegistry.markCompleted + Reputation.recordSuccess)
    if (validation.approved) {
      await this.validator.releaseEscrow(task.id, this.dataAgent.address, bounty);
    }

    // 7. Treasury: budget check + on-chain recordSpending (real tx)
    await this.treasury.canAuthorizeSpend(this.dataAgent.address, bounty);
    await this.treasury.recordSpendingOnChain(this.dataAgent.address, bounty);

    const data = rawData as { sources: unknown[]; queryCount: number };
    const compute = computeResult as { computeUnits: number };

    const result: CycleResult = {
      taskId: task.id,
      query,
      bounty: `${Number(bounty) / 1e6}`,
      subtaskCount: task.subtasks.length,
      dataSourcesQueried: data.sources?.length ?? 0,
      computeUnitsUsed: compute.computeUnits ?? 0,
      validationScore: validation.score,
      approved: validation.approved,
      paymentsGenerated: this.treasury.getAuditSummary().totalTransactions,
      durationMs: Date.now() - start,
    };

    this.cycleResults.push(result);

    emitEvent("task:completed", {
      taskId: task.id, approved: validation.approved,
      score: validation.score, durationMs: result.durationMs,
    });

    return result;
  }

  async runDemo(cycles: number = 10): Promise<{ results: CycleResult[]; summary: Record<string, unknown> }> {
    if (this.running) throw new Error("Demo already running");
    this.running = true;

    const results: CycleResult[] = [];
    const bounty = 10000n; // $0.01 per task

    for (let i = 0; i < cycles; i++) {
      const query = DEMO_QUERIES[i % DEMO_QUERIES.length];
      try {
        const result = await this.runTaskCycle(query, bounty);
        results.push(result);
      } catch (error) {
        console.error(`Cycle ${i + 1} failed:`, error);
      }
      await new Promise(r => setTimeout(r, 100));
    }

    this.running = false;

    return {
      results,
      summary: {
        cyclesCompleted: results.length,
        approved: results.filter(r => r.approved).length,
        rejected: results.filter(r => !r.approved).length,
        ...this.treasury.getAuditSummary(),
        agents: {
          orchestrator: this.orchestrator.getStats(),
          data: this.dataAgent.getStats(),
          compute: this.computeAgent.getStats(),
          validator: this.validator.getStats(),
          treasury: this.treasury.getStats(),
        },
      },
    };
  }

  isRunning(): boolean {
    return this.running;
  }

  getAgentStats() {
    return {
      orchestrator: this.orchestrator.getStats(),
      data: this.dataAgent.getStats(),
      compute: this.computeAgent.getStats(),
      validator: this.validator.getStats(),
      treasury: this.treasury.getStats(),
    };
  }

  getCycleResults(): CycleResult[] {
    return this.cycleResults;
  }
}

/** Singleton pipeline instance */
export function getPipeline(): AgentPipeline {
  if (!pipeline) {
    pipeline = new AgentPipeline();
  }
  return pipeline;
}

export async function initPipeline(): Promise<AgentPipeline> {
  const p = getPipeline();
  await p.initialize();
  return p;
}
