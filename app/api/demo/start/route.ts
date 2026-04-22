import { NextResponse, type NextRequest } from "next/server";
import { initPipeline } from "@/lib/agents/pipeline";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const cycles = Math.min(body.cycles || 10, 20); // Cap at 20

    const pipeline = await initPipeline();

    if (pipeline.isRunning()) {
      return NextResponse.json({ error: "Demo already running" }, { status: 409 });
    }

    // Run in background — events stream via SSE
    pipeline.runDemo(cycles).then((result) => {
      console.log(`Demo complete: ${result.results.length} cycles`);
    }).catch(console.error);

    return NextResponse.json({
      status: "started",
      cycles,
      message: `Running ${cycles} task cycles. Watch events via /api/events/stream`,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
