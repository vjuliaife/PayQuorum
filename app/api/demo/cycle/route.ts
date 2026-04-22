import { NextResponse, type NextRequest } from "next/server";
import { initPipeline } from "@/lib/agents/pipeline";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const query = body.query || "Analyze AAPL financial metrics and analyst sentiment";
    const bounty = BigInt(body.bounty || 10000); // default $0.01

    const pipeline = await initPipeline();
    const result = await pipeline.runTaskCycle(query, bounty);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
