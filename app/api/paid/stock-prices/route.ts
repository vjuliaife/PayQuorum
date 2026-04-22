import { NextResponse, type NextRequest } from "next/server";
import { verifyPayment, build402Response } from "@/lib/x402-seller";
import { fetchStockPrices } from "@/lib/aisa-client";
import { emitEvent } from "@/lib/events";

const PRICE = "$0.005";
const PAY_TO = process.env.ORCHESTRATOR_PRIVATE_KEY ? "configured" : "unconfigured";

export async function GET(request: NextRequest) {
  // Check x402 payment (skip if no wallet configured)
  if (PAY_TO !== "unconfigured") {
    const paid = await verifyPayment(request);
    if (!paid && request.headers.has("payment-signature")) {
      // Payment present but invalid
      return NextResponse.json({ error: "Payment verification failed" }, { status: 402 });
    }
    if (!paid) {
      return build402Response(PRICE, PAY_TO, "Stock price data from AIsa", request.url);
    }
  }

  const ticker = request.nextUrl.searchParams.get("ticker") || "AAPL";
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  try {
    const data = await fetchStockPrices(ticker, "day", startDate, endDate);
    emitEvent("aisa:query", { endpoint: "stock-prices", ticker, source: "AIsa" });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 502 });
  }
}
