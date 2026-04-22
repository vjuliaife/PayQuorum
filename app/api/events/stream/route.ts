import { createSSEStream } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET() {
  const stream = createSSEStream();

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
