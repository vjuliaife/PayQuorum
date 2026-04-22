import { NextResponse, type NextRequest } from "next/server";
import { getPublicClient, BudgetControllerABI } from "@/lib/blockchain";
import { config } from "@/lib/config";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;

  if (!config.contracts.budgetController) {
    return NextResponse.json(
      { error: "BudgetController not deployed" },
      { status: 503 },
    );
  }

  try {
    const client = getPublicClient();
    const remaining = await client.readContract({
      address: config.contracts.budgetController,
      abi: BudgetControllerABI,
      functionName: "remainingDailyBudget",
      args: [address as `0x${string}`],
    });

    return NextResponse.json({
      address,
      remainingDailyBudget: Number(remaining) / 1e6,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
