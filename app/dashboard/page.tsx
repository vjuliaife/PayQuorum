"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";

interface PQEvent {
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
}

interface Stats {
  totalTransactions: number;
  totalEvents: number;
  byType: Record<string, number>;
  meetsMinimum: boolean;
}

// Simplified semantic color groups (inspired by nansen-hunt-alpha)
// Green = money/success, Blue = info/progress, Amber = validation, Purple = escrow, Gray = system
const EVENT_COLORS: Record<string, string> = {
  "task:created": "#22c55e",
  "task:bid": "#3b82f6",
  "task:assigned": "#3b82f6",
  "task:completed": "#00ff88",
  "escrow:locked": "#8b5cf6",
  "escrow:released": "#00ff88",
  "payment:x402": "#06b6d4",
  "payment:nanopayment": "#06b6d4",
  "reputation:updated": "#eab308",
  "budget:recorded": "#f59e0b",
  "budget:denied": "#ff3366",
  "agent:initialized": "#444",
  "agent:action": "#8B8D97",
  "aisa:query": "#06b6d4",
};

// Human-readable labels for event types
const EVENT_LABELS: Record<string, string> = {
  "task:created": "Task Created",
  "task:bid": "Bid Placed",
  "task:assigned": "Task Assigned",
  "task:completed": "Task Complete",
  "escrow:locked": "Escrow Locked",
  "escrow:released": "Escrow Released",
  "payment:x402": "x402 Payment",
  "payment:nanopayment": "Nanopayment",
  "reputation:updated": "Rep Updated",
  "budget:recorded": "Budget Logged",
  "budget:denied": "Budget Denied",
  "agent:initialized": "Agent Init",
  "agent:action": "Agent Action",
  "aisa:query": "AIsa Query",
};

const AGENTS = [
  { name: "Orchestrator", role: "Task decomposition", color: "#22c55e" },
  { name: "DataAgent", role: "AIsa + Featherless AI", color: "#06b6d4" },
  { name: "ComputeAgent", role: "Gemini 2.5 Flash", color: "#8b5cf6" },
  { name: "ValidatorAgent", role: "ERC-8004 scoring", color: "#f59e0b" },
  { name: "TreasuryAgent", role: "On-chain budgets", color: "#ec4899" },
];

export default function DashboardPage() {
  const [events, setEvents] = useState<PQEvent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [connected, setConnected] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [dailyLimit, setDailyLimit] = useState("1.00");
  const [perTaskLimit, setPerTaskLimit] = useState("0.10");
  const feedRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  // SSE connection
  useEffect(() => {
    const evtSource = new EventSource("/api/events/stream");
    evtSource.onopen = () => setConnected(true);
    evtSource.onerror = () => setConnected(false);
    evtSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "history") {
          setEvents(data.events || []);
        } else {
          setEvents((prev) => [...prev, data]);
        }
      } catch { /* ignore */ }
    };
    return () => evtSource.close();
  }, []);

  // Poll stats + auto-start
  const autoStarted = useRef(false);
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
          if (!autoStarted.current && data.totalEvents === 0 && !demoRunning) {
            autoStarted.current = true;
            setDemoRunning(true);
            fetch("/api/demo/start", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cycles: 3 }),
            }).catch(() => {});
            setTimeout(() => setDemoRunning(false), 90000);
          }
        }
      } catch { /* not ready */ }
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [demoRunning]);

  // Scroll to top when new events arrive (newest first)
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [events]);

  const handleScroll = useCallback(() => {
    if (!feedRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
  }, []);

  const startDemo = async () => {
    setDemoRunning(true);
    try {
      await fetch("/api/demo/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycles: 8 }),
      });
    } catch (e) { console.error(e); }
    setTimeout(() => setDemoRunning(false), 120000);
  };

  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetError, setBudgetError] = useState("");
  const saveBudget = async () => {
    setBudgetSaving(true);
    setBudgetError("");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      const res = await fetch("/api/budget/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyLimit, perTaskLimit }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json();
      if (data.success) {
        setShowSettings(false);
        setBudgetError("");
      } else {
        setBudgetError(data.error?.slice(0, 80) || "Failed to save");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setBudgetError(msg.includes("abort") ? "Timed out — check deployer wallet has funds" : msg.slice(0, 80));
    } finally {
      setBudgetSaving(false);
    }
  };

  const txCount = stats?.totalTransactions ?? 0;
  const onChainTxs = events.filter((e) => Boolean(e.data.tx)).length;
  const totalSpend = events
    .filter((e) => e.data.cost || e.data.amount)
    .reduce((sum, e) => sum + Number(e.data.cost || e.data.amount || 0), 0);

  // Filter out agent:initialized from the main feed (noise)
  const feedEvents = events.filter((e) => e.type !== "agent:initialized");

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-white/[0.06] px-5 py-3 flex items-center justify-between shrink-0 backdrop-blur-sm bg-[#0B0D11]/80">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[14px] font-semibold tracking-tight hover:opacity-80 transition-opacity">
            PayQuorum
          </Link>
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md border border-white/[0.06] text-[11px] text-[#8B8D97]">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-500 pulse-gentle" : "bg-red-500"}`} />
            Arc Testnet
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="text-[11px] px-3 py-1.5 rounded-md border border-white/[0.08] text-[#8B8D97] hover:text-white hover:border-white/[0.16] transition-all"
          >
            Settings
          </button>
          <button
            onClick={startDemo}
            disabled={demoRunning}
            className={`text-[12px] px-5 py-1.5 rounded-md font-medium transition-all ${
              demoRunning
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-not-allowed"
                : "bg-emerald-500 text-white hover:bg-emerald-400 shadow-[0_0_12px_rgba(34,197,94,0.3)] hover:shadow-[0_0_20px_rgba(34,197,94,0.4)]"
            }`}
          >
            {demoRunning ? (
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Running
              </span>
            ) : "Run Demo"}
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-px bg-white/[0.04] border-b border-white/[0.06] shrink-0">
        <div className="bg-[#0B0D11] p-4 border-t-2 border-t-emerald-500/60">
          <div className="text-[28px] font-bold font-[family-name:var(--font-geist-mono)] tabular-nums text-emerald-400" style={{ textShadow: "0 0 12px rgba(0,255,136,0.2)" }}>
            {txCount}
          </div>
          <div className="text-[11px] text-[#555] mt-0.5">Transactions</div>
        </div>
        <div className="bg-[#0B0D11] p-4 border-t-2 border-t-cyan-500/30">
          <div className="text-[28px] font-bold font-[family-name:var(--font-geist-mono)] tabular-nums">
            {onChainTxs}
          </div>
          <div className="text-[11px] text-[#555] mt-0.5">On-Chain Txs</div>
        </div>
        <div className="bg-[#0B0D11] p-4 border-t-2 border-t-blue-500/30">
          <div className="text-[22px] font-semibold font-[family-name:var(--font-geist-mono)] tabular-nums">
            ${totalSpend.toFixed(4)}
          </div>
          <div className="text-[11px] text-[#555] mt-0.5">System Spend (USDC)</div>
        </div>
        <div className="bg-[#0B0D11] p-4 border-t-2 border-t-emerald-500/30">
          <div className="text-[22px] font-semibold font-[family-name:var(--font-geist-mono)] tabular-nums text-emerald-400/80">
            ${(onChainTxs * 0.01).toFixed(2)}
          </div>
          <div className="text-[11px] text-[#555] mt-0.5">Arc Gas ({onChainTxs} txs)</div>
          <div className="text-[9px] text-red-400/60 mt-0.5 font-[family-name:var(--font-geist-mono)]">
            vs ${(onChainTxs * 0.50).toFixed(2)} on Ethereum
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 grid grid-cols-[260px_1fr_280px] min-h-0">
        {/* Left — Agents + Margin */}
        <div className="border-r border-white/[0.06] p-4 overflow-y-auto">
          <h2 className="text-[10px] uppercase tracking-widest text-[#555] mb-3">Agents</h2>
          <div className="space-y-1">
            {AGENTS.map((agent) => {
              const count = events.filter((e) => e.data.agent === agent.name).length;
              const active = events.some((e) => e.data.agent === agent.name);
              return (
                <div
                  key={agent.name}
                  className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-white/[0.02] transition-all group"
                  style={{ borderLeft: `2px solid ${active ? agent.color : "transparent"}` }}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? "pulse-gentle" : ""}`} style={{ background: active ? agent.color : "#333" }} />
                    <div>
                      <div className="text-[12px] font-medium">{agent.name}</div>
                      <div className="text-[10px] text-[#555]">{agent.role}</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-[family-name:var(--font-geist-mono)] tabular-nums" style={{ color: active ? agent.color : "#555" }}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>

          <h2 className="text-[10px] uppercase tracking-widest text-[#555] mt-6 mb-3">Gas Comparison</h2>
          <div className="space-y-1 text-[11px]">
            {[
              { network: "Ethereum L1", total: (onChainTxs * 0.5).toFixed(2), color: "#ff3366", bg: "rgba(255,51,102,0.06)" },
              { network: "L2 (Base)", total: (onChainTxs * 0.02).toFixed(2), color: "#f59e0b", bg: "rgba(245,158,11,0.06)" },
              { network: "Arc", total: (onChainTxs * 0.01).toFixed(2), color: "#00ff88", bg: "rgba(0,255,136,0.06)" },
            ].map((row) => (
              <div key={row.network} className="flex items-center justify-between px-3 py-2 rounded-md" style={{ background: row.bg }}>
                <span className="text-[#8B8D97]">{row.network}</span>
                <span className="font-[family-name:var(--font-geist-mono)] tabular-nums" style={{ color: row.color }}>
                  ${row.total}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Center — Transaction Feed */}
        <div className="flex flex-col min-h-0">
          <div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center justify-between shrink-0 bg-[#080A0E]">
            <h2 className="text-[10px] uppercase tracking-widest text-[#555]">Transaction Feed</h2>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-[family-name:var(--font-geist-mono)] text-emerald-400/60 tabular-nums">
                {onChainTxs} on-chain
              </span>
              <span className="text-[10px] font-[family-name:var(--font-geist-mono)] text-[#444] tabular-nums">
                {feedEvents.length} total
              </span>
            </div>
          </div>
          <div
            ref={feedRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-1 py-1 feed-scroll bg-[#070910]"
          >
            {feedEvents.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[12px] text-[#444]">
                <div className="text-center">
                  <div className="mb-2">Initializing agent pipeline...</div>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mx-auto" />
                </div>
              </div>
            ) : (
              [...feedEvents].reverse().map((event, i) => {
                const hasTx = Boolean(event.data.tx);
                return (
                  <div
                    key={i}
                    className={`event-enter flex items-center gap-2 px-2 py-[4px] border-l-2 ml-1 mb-px transition-colors ${hasTx ? "hover:bg-emerald-500/[0.03]" : "hover:bg-white/[0.01]"}`}
                    style={{ borderLeftColor: EVENT_COLORS[event.type] || "#333" }}
                  >
                    <span className="text-[9px] font-[family-name:var(--font-geist-mono)] text-[#333] w-[62px] shrink-0">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                    <span
                      className="text-[10px] font-medium w-[100px] shrink-0"
                      style={{ color: EVENT_COLORS[event.type] || "#666" }}
                    >
                      {EVENT_LABELS[event.type] || event.type}
                    </span>
                    <span className="text-[10px] text-[#666] truncate flex-1">
                      {event.data.amount != null && (
                        <span className="text-emerald-400 font-[family-name:var(--font-geist-mono)]">${String(event.data.amount)} </span>
                      )}
                      {event.data.cost != null && (
                        <span className="text-emerald-400 font-[family-name:var(--font-geist-mono)]">${String(event.data.cost)} </span>
                      )}
                      {"source" in event.data && <span>{String(event.data.source)} </span>}
                      {"agent" in event.data && <span className="text-[#555]">{String(event.data.agent)} </span>}
                      {"action" in event.data && <span className="text-[#444]">{String(event.data.action)} </span>}
                      {"ticker" in event.data && <span>{String(event.data.ticker)} </span>}
                      {"query" in event.data && (
                        <span className="text-[#444]">{String(event.data.query).slice(0, 40)}</span>
                      )}
                    </span>
                    {hasTx ? (
                      <a
                        href={`https://testnet.arcscan.app/tx/${String(event.data.tx)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] font-[family-name:var(--font-geist-mono)] text-cyan-400/70 hover:text-cyan-300 shrink-0 transition-colors"
                        title={String(event.data.tx)}
                      >
                        {String(event.data.tx).slice(0, 6)}...{String(event.data.tx).slice(-4)}
                      </a>
                    ) : (
                      <span className="w-[76px] shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right — Pipeline + Settings */}
        <div className="border-l border-white/[0.06] p-4 overflow-y-auto">
          <h2 className="text-[10px] uppercase tracking-widest text-[#555] mb-3">Pipeline</h2>
          <div className="space-y-0">
            {AGENTS.map((agent, i) => {
              const active = events.some((e) => e.data.agent === agent.name);
              return (
                <div key={agent.name}>
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${active ? "pulse-gentle" : ""}`}
                      style={{ background: active ? agent.color : "#333", boxShadow: active ? `0 0 6px ${agent.color}40` : "none" }}
                    />
                    <div>
                      <span className="text-[11px] font-medium">{agent.name}</span>
                      <span className="text-[9px] text-[#444] ml-1.5">{agent.role}</span>
                    </div>
                  </div>
                  {i < AGENTS.length - 1 && (
                    <div className="ml-[11px] h-3 w-px bg-white/[0.06]" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Budget Settings */}
          <h2 className="text-[10px] uppercase tracking-widest text-[#555] mt-6 mb-3">
            Budget Policy
            <button onClick={() => setShowSettings(!showSettings)} className="ml-2 text-[9px] text-cyan-400/60 hover:text-cyan-400 transition-colors">
              {showSettings ? "hide" : "edit"}
            </button>
          </h2>
          {showSettings ? (
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-[#555] block mb-1">Daily Limit (USDC)</label>
                <input
                  type="text"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(e.target.value)}
                  className="w-full bg-[#0D0F14] border border-white/[0.08] rounded px-2.5 py-1.5 text-[12px] font-[family-name:var(--font-geist-mono)] text-white focus:border-cyan-500/40 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#555] block mb-1">Per-Task Limit (USDC)</label>
                <input
                  type="text"
                  value={perTaskLimit}
                  onChange={(e) => setPerTaskLimit(e.target.value)}
                  className="w-full bg-[#0D0F14] border border-white/[0.08] rounded px-2.5 py-1.5 text-[12px] font-[family-name:var(--font-geist-mono)] text-white focus:border-cyan-500/40 focus:outline-none transition-colors"
                />
              </div>
              <button
                onClick={saveBudget}
                disabled={budgetSaving}
                className="w-full text-[11px] py-1.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 disabled:opacity-50 transition-colors"
              >
                {budgetSaving ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    Saving on-chain...
                  </span>
                ) : "Save Budget Policy"}
              </button>
              {budgetError && (
                <p className="text-[10px] text-red-400 mt-1">{budgetError}</p>
              )}
            </div>
          ) : (
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between px-2 py-1">
                <span className="text-[#555]">Daily limit</span>
                <span className="font-[family-name:var(--font-geist-mono)] text-[#8B8D97]">${dailyLimit}</span>
              </div>
              <div className="flex justify-between px-2 py-1">
                <span className="text-[#555]">Per-task limit</span>
                <span className="font-[family-name:var(--font-geist-mono)] text-[#8B8D97]">${perTaskLimit}</span>
              </div>
            </div>
          )}

          {/* Event Breakdown */}
          <h2 className="text-[10px] uppercase tracking-widest text-[#555] mt-6 mb-3">Events</h2>
          <div className="space-y-0.5">
            {stats?.byType &&
              Object.entries(stats.byType)
                .filter(([type]) => type !== "agent:initialized")
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between px-2 py-1 text-[10px] rounded hover:bg-white/[0.02] transition-colors">
                    <span style={{ color: EVENT_COLORS[type] || "#666" }}>{EVENT_LABELS[type] || type}</span>
                    <span className="font-[family-name:var(--font-geist-mono)] text-[#555] tabular-nums">{count}</span>
                  </div>
                ))}
          </div>
        </div>
      </div>
    </div>
  );
}
