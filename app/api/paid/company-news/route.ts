import { NextResponse, type NextRequest } from "next/server";
import { fetchCompanyNews } from "@/lib/aisa-client";
import { emitEvent } from "@/lib/events";

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker") || "AAPL";
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "10");

  try {
    const data = await fetchCompanyNews(ticker, limit);
    emitEvent("aisa:query", { endpoint: "company-news", ticker, source: "AIsa" });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 502 });
  }
}
