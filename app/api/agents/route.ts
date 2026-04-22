import { NextResponse } from "next/server";
import { getPipeline } from "@/lib/agents/pipeline";

export async function GET() {
  try {
    const pipeline = getPipeline();
    return NextResponse.json({
      agents: pipeline.getAgentStats(),
      cycleResults: pipeline.getCycleResults(),
      running: pipeline.isRunning(),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
