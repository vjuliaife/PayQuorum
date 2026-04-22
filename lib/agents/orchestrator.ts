import type { Address } from "viem";
import { BaseAgent } from "./base-agent";
import { AgentRole, type AgentConfig, type Task, type SubTask } from "./types";
import { config } from "../config";
import { TaskRegistryABI, ERC20_ABI } from "../blockchain";

export class OrchestratorAgent extends BaseAgent {
  private tasks: Map<number, Task> = new Map();
  private registeredAgents: Map<AgentRole, Address> = new Map();
  private taskCounter = 0;

  constructor(agentConfig: AgentConfig) {
    super({ ...agentConfig, role: AgentRole.Orchestrator });
  }

  async initialize(): Promise<void> {
    this.log(`Initialized at ${this.address}`);
    this.emit("agent:initialized", { role: this.role, address: this.address });
  }

  registerAgent(role: AgentRole, address: Address): void {
    this.registeredAgents.set(role, address);
    this.log(`Registered ${role} agent: ${address.slice(0, 12)}...`);
  }

  decomposeTask(query: string, totalBounty: bigint): SubTask[] {
    const taskId = this.taskCounter;
    return [
      {
        id: `${taskId}-data`,
        parentTaskId: taskId,
        type: "data_fetch",
        description: `Fetch financial data for: ${query}`,
        requiredCapability: "data_fetch",
        status: "pending",
        payment: (totalBounty * 30n) / 100n,
      },
      {
        id: `${taskId}-compute`,
        parentTaskId: taskId,
        type: "compute",
        description: `Analyze and process data for: ${query}`,
        requiredCapability: "compute",
        status: "pending",
        payment: (totalBounty * 50n) / 100n,
      },
      {
        id: `${taskId}-validate`,
        parentTaskId: taskId,
        type: "validate",
        description: `Validate output quality for: ${query}`,
        requiredCapability: "validate",
        status: "pending",
        payment: (totalBounty * 20n) / 100n,
      },
    ];
  }

  async submitTask(query: string, bounty: bigint): Promise<Task> {
    let taskId = this.taskCounter++;
    this.log(`Submitting: "${query}" | bounty: ${Number(bounty) / 1e6} USDC`);

    // On-chain task creation (if contracts deployed)
    if (config.contracts.taskRegistry && config.contracts.usdc) {
      try {
        // Read the REAL on-chain nextTaskId before creating
        const nextId = await this.publicClient.readContract({
          address: config.contracts.taskRegistry,
          abi: TaskRegistryABI as readonly unknown[],
          functionName: "nextTaskId",
        });
        taskId = Number(nextId as bigint);
        this.log(`On-chain taskId will be: ${taskId}`);

        // Approve USDC
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const approveTx = await (this.walletClient as any).writeContract({
          address: config.contracts.usdc,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [config.contracts.taskRegistry, bounty],
        });
        await this.publicClient.waitForTransactionReceipt({ hash: approveTx });
        this.log(`USDC approved: ${approveTx}`);
        this.emit("task:created", { taskId, action: "usdc_approved", tx: approveTx });

        // Create task on-chain
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const createTx = await (this.walletClient as any).writeContract({
          address: config.contracts.taskRegistry,
          abi: TaskRegistryABI,
          functionName: "createTask",
          args: [query, bounty],
        });
        await this.publicClient.waitForTransactionReceipt({ hash: createTx });
        this.log(`Task created on-chain: ${createTx}`);
        this.emit("escrow:locked", { taskId, amount: Number(bounty) / 1e6, tx: createTx });

        this.recordPayment({
          from: this.address, to: config.contracts.taskRegistry,
          amount: bounty, taskId, subtaskId: "escrow",
          timestamp: Date.now(), txHash: createTx, type: "escrow_lock",
        });
      } catch (error) {
        this.log(`On-chain creation failed: ${error}`);
      }
    }

    const subtasks = this.decomposeTask(query, bounty);
    const task: Task = { id: taskId, description: query, bounty, subtasks, status: "decomposed" };
    this.tasks.set(taskId, task);

    this.emit("task:created", {
      taskId, bounty: Number(bounty) / 1e6,
      subtaskCount: subtasks.length, query,
    });

    return task;
  }

  async assignSubtasks(task: Task): Promise<void> {
    for (const subtask of task.subtasks) {
      const roleMap: Record<string, AgentRole> = {
        data_fetch: AgentRole.Data,
        compute: AgentRole.Compute,
        validate: AgentRole.Validator,
      };
      const role = roleMap[subtask.type];
      const addr = this.registeredAgents.get(role);
      if (addr) {
        subtask.assignedAgent = addr;
        subtask.status = "assigned";
        this.emit("task:assigned", {
          taskId: task.id, subtaskId: subtask.id,
          type: subtask.type, agent: addr.slice(0, 12),
          payment: Number(subtask.payment) / 1e6,
        });
      }
    }
    task.status = "in_progress";
  }

  getTask(taskId: number): Task | undefined {
    return this.tasks.get(taskId);
  }
}
