import { NextResponse, type NextRequest } from "next/server";
import { fetchAnalystEstimates } from "@/lib/aisa-client";
import { emitEvent } from "@/lib/events";

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker") || "AAPL";

  try {
    const data = await fetchAnalystEstimates(ticker);
    emitEvent("aisa:query", { endpoint: "analyst-estimates", ticker, source: "AIsa" });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 502 });
  }
}
