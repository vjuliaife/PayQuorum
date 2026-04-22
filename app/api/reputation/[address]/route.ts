import { NextResponse, type NextRequest } from "next/server";
import { getPublicClient, formatUSDC, ReputationABI } from "@/lib/blockchain";
import { config } from "@/lib/config";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;

  if (!config.contracts.reputation) {
    return NextResponse.json(
      { error: "Reputation contract not deployed" },
      { status: 503 },
    );
  }

  try {
    const client = getPublicClient();
    const result = await client.readContract({
      address: config.contracts.reputation,
      abi: ReputationABI,
      functionName: "getReputation",
      args: [address as `0x${string}`],
    });

    const rep = result as [bigint, bigint, bigint, bigint, bigint, boolean];
    return NextResponse.json({
      address,
      completedTasks: Number(rep[0]),
      failedTasks: Number(rep[1]),
      totalEarned: formatUSDC(rep[2]),
      score: Number(rep[3]),
      registeredAt: Number(rep[4]),
      registered: rep[5],
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
