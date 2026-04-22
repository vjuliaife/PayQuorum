import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getTransactionCount } from "@/lib/events";

export async function GET() {
  return NextResponse.json({
    project: "PayQuorum",
    description: "Trustless Agent Task Marketplace on Arc",
    chain: "Arc Testnet",
    chainId: config.chainId,
    explorer: "https://testnet.arcscan.app",
    usdc: config.contracts.usdc,
    contracts: {
      taskRegistry: config.contracts.taskRegistry || "not deployed",
      agentEscrow: config.contracts.agentEscrow || "not deployed",
      reputation: config.contracts.reputation || "not deployed",
      budgetController: config.contracts.budgetController || "not deployed",
    },
    transactionCount: getTransactionCount(),
    x402Facilitator: config.x402FacilitatorUrl,
  });
}
