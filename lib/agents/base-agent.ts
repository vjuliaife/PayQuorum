import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type PublicClient,
  type WalletClient,
  type Chain,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { arcTestnet } from "../config";
import { emitEvent, type EventType } from "../events";
import type { AgentConfig, AgentRole, PaymentRecord } from "./types";

const chain = arcTestnet as unknown as Chain;
const rpc = process.env.ARC_TESTNET_RPC || "https://rpc.testnet.arc.network";

export abstract class BaseAgent {
  readonly role: AgentRole;
  readonly name: string;
  readonly address: Address;
  readonly publicClient: PublicClient;
  readonly walletClient: WalletClient;
  protected payments: PaymentRecord[] = [];

  constructor(agentConfig: AgentConfig) {
    this.role = agentConfig.role;
    this.name = agentConfig.name;

    const key = agentConfig.privateKey || generatePrivateKey();
    const account = privateKeyToAccount(key);
    this.address = account.address;

    this.publicClient = createPublicClient({ chain, transport: http(rpc) });
    this.walletClient = createWalletClient({ account, chain, transport: http(rpc) });
  }

  protected log(message: string): void {
    const ts = new Date().toISOString().slice(11, 23);
    console.log(`[${ts}] [${this.name}] ${message}`);
  }

  protected emit(type: EventType, data: Record<string, unknown>): void {
    emitEvent(type, { agent: this.name, ...data });
  }

  protected recordPayment(record: PaymentRecord): void {
    this.payments.push(record);
  }

  getPayments(): PaymentRecord[] {
    return [...this.payments];
  }

  getStats(): Record<string, unknown> {
    return {
      role: this.role,
      name: this.name,
      address: this.address,
      totalPayments: this.payments.length,
    };
  }

  abstract initialize(): Promise<void>;
}
