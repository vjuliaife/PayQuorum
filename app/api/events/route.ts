import { NextResponse } from "next/server";
import { getEventLog, getTransactionCount } from "@/lib/events";

export async function GET() {
  return NextResponse.json({
    events: getEventLog(),
    transactionCount: getTransactionCount(),
  });
}
