/**
 * Event system for PayQuorum — stores events and broadcasts via SSE.
 *
 * In-memory event store with Server-Sent Events streaming.
 * SSE replaces WebSocket for Vercel compatibility.
 */

export type EventType =
  | "task:created"
  | "task:bid"
  | "task:assigned"
  | "task:completed"
  | "escrow:locked"
  | "escrow:released"
  | "escrow:refunded"
  | "payment:x402"
  | "payment:nanopayment"
  | "reputation:updated"
  | "budget:recorded"
  | "budget:denied"
  | "agent:initialized"
  | "agent:action"
  | "aisa:query";

export interface PayQuorumEvent {
  type: EventType;
  timestamp: number;
  data: Record<string, unknown>;
}

// In-memory event store
const eventLog: PayQuorumEvent[] = [];

// SSE subscriber callbacks
type Subscriber = (event: PayQuorumEvent) => void;
const subscribers = new Set<Subscriber>();

export function emitEvent(type: EventType, data: Record<string, unknown>): void {
  const event: PayQuorumEvent = { type, timestamp: Date.now(), data };
  eventLog.push(event);

  // Notify all SSE subscribers
  for (const sub of subscribers) {
    try {
      sub(event);
    } catch {
      subscribers.delete(sub);
    }
  }
}

export function getEventLog(): PayQuorumEvent[] {
  return eventLog;
}

export function getTransactionCount(): number {
  return eventLog.filter((e) =>
    e.type.startsWith("task:") ||
    e.type.startsWith("escrow:") ||
    e.type.startsWith("payment:") ||
    e.type === "reputation:updated" ||
    e.type === "budget:recorded" ||
    e.type === "aisa:query"
  ).length;
}

export function getStats() {
  const byType: Record<string, number> = {};
  eventLog.forEach((e) => { byType[e.type] = (byType[e.type] || 0) + 1; });

  return {
    totalTransactions: getTransactionCount(),
    totalEvents: eventLog.length,
    byType,
    meetsMinimum: getTransactionCount() >= 50,
  };
}

/**
 * Create an SSE ReadableStream for a Next.js Route Handler.
 * Sends all existing events as history, then streams new events as they arrive.
 */
export function createSSEStream(): ReadableStream {
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      // Send event history
      send(JSON.stringify({ type: "history", events: eventLog }));

      // Subscribe to new events
      const subscriber: Subscriber = (event) => {
        try {
          send(JSON.stringify(event));
        } catch {
          subscribers.delete(subscriber);
        }
      };

      subscribers.add(subscriber);

      // Keep connection alive with heartbeats
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          subscribers.delete(subscriber);
        }
      }, 15000);
    },
  });
}
