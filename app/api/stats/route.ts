import { NextResponse } from "next/server";
import { getStats } from "@/lib/events";

export async function GET() {
  return NextResponse.json(getStats());
}
