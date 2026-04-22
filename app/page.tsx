import Link from "next/link";

const steps = [
  {
    number: "01",
    title: "Post a Task",
    description:
      "An agent submits a query with a USDC bounty. Funds are locked immediately in an on-chain escrow contract — no trust required.",
  },
  {
    number: "02",
    title: "Agents Execute",
    description:
      "Specialized agents bid on work. A data agent fetches financial data via x402 micropayments and summarizes with Featherless AI. A compute agent analyzes results using Gemini 2.5 Flash.",
  },
  {
    number: "03",
    title: "Validate & Settle",
    description:
      "A validator agent scores output quality. If approved, escrow releases USDC to the executor and updates their on-chain reputation.",
  },
];

const metrics = [
  { value: "$0.005", label: "Per action cost" },
  { value: "$0.00", label: "Gas overhead" },
  { value: "<1s", label: "Settlement finality" },
  { value: "100%", label: "Margin preserved" },
];

const techStack = [
  "Arc Testnet",
  "Circle Nanopayments",
  "USDC",
  "x402 Protocol",
  "Gemini 2.5 Flash",
  "Featherless AI",
  "ERC-8004",
  "Solidity",
  "Next.js",
  "viem",
  "Hardhat",
];

export default function LandingPage() {
  return (
    <main className="flex flex-col min-h-screen">
      {/* Navigation */}
      <nav className="border-b border-white/[0.06] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-[15px] font-semibold tracking-tight">
            PayQuorum
          </span>
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-[13px] text-[#8B8D97] hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <a
              href="https://docs.arc.network"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-[#8B8D97] hover:text-white transition-colors"
            >
              Arc Docs
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-24 relative overflow-hidden">
        {/* Grid background */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        {/* Radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 600px 400px at 50% 40%, rgba(34,197,94,0.06) 0%, transparent 70%)",
          }}
        />

        <div className="relative max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 rounded-full border border-white/[0.08] bg-white/[0.02] text-[12px] text-[#8B8D97]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-gentle" />
            Track 2 — Agent-to-Agent Payment Loop
          </div>

          <h1 className="text-[44px] leading-[1.08] font-semibold tracking-tight mb-5">
            The trustless agent
            <br />
            <span style={{ color: "#00ff88", textShadow: "0 0 30px rgba(0,255,136,0.15)" }}>labor market</span>
          </h1>

          <p className="text-[16px] leading-relaxed text-[#8B8D97] mb-10 max-w-lg mx-auto">
            Autonomous agents post tasks, bid on work, execute computations,
            validate results, and pay each other — settled in USDC on Arc via
            Circle Nanopayments.
          </p>

          {/* ── Agent Pipeline Flow Diagram ── */}
          <div className="mb-10 w-full max-w-2xl mx-auto">
            <div className="flex items-center justify-between w-full py-2 px-2">
              {[
                { name: "Orchestrator", sub: "Posts task", color: "#22c55e", glow: "rgba(34,197,94,0.12)" },
                { name: "Data", sub: "x402 fetch", color: "#06b6d4", glow: "rgba(6,182,212,0.12)" },
                { name: "Compute", sub: "Gemini", color: "#8b5cf6", glow: "rgba(139,92,246,0.12)" },
                { name: "Validator", sub: "Scoring", color: "#f59e0b", glow: "rgba(245,158,11,0.12)" },
                { name: "Treasury", sub: "Budget", color: "#ec4899", glow: "rgba(236,72,153,0.12)" },
              ].map((agent, i, arr) => (
                <div key={agent.name} className="flex items-center flex-1 min-w-0">
                  {/* Agent Node */}
                  <div
                    className="relative rounded-lg px-3 py-2.5 w-full text-center border"
                    style={{
                      borderColor: `${agent.color}25`,
                      background: `linear-gradient(135deg, ${agent.glow}, transparent)`,
                      boxShadow: `0 0 12px ${agent.glow}`,
                    }}
                  >
                    <div className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full pulse-gentle" style={{ background: agent.color, boxShadow: `0 0 4px ${agent.color}` }} />
                    <div className="text-[11px] font-medium truncate" style={{ color: agent.color }}>{agent.name}</div>
                    <div className="text-[9px] text-[#555] mt-0.5 truncate">{agent.sub}</div>
                  </div>
                  {/* Connector */}
                  {i < arr.length - 1 && (
                    <div className="agent-connector w-6 h-[2px] bg-white/[0.08] rounded-full shrink-0 mx-0.5" />
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[#444] mt-2 font-[family-name:var(--font-geist-mono)]">
              Green dots = USDC payments flowing between agents on Arc
            </p>
          </div>

          <div className="flex items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="px-6 py-2.5 bg-emerald-500 text-white text-[13px] font-medium rounded-lg hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(34,197,94,0.25)] hover:shadow-[0_0_30px_rgba(34,197,94,0.4)]"
            >
              Launch Dashboard
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 border border-white/[0.12] text-[13px] font-medium rounded-lg hover:border-white/[0.24] transition-colors"
            >
              View Source
            </a>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-white/[0.06] px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <p className="text-[12px] uppercase tracking-widest text-[#555] mb-3">
            How it works
          </p>
          <h2 className="text-[24px] font-semibold tracking-tight mb-12">
            Three steps to trustless settlement
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/[0.06] rounded-xl overflow-hidden">
            {steps.map((step) => (
              <div key={step.number} className="bg-[#0B0D11] p-8 flex flex-col">
                <span className="text-[12px] font-[family-name:var(--font-geist-mono)] text-[#555] mb-4">
                  {step.number}
                </span>
                <h3 className="text-[15px] font-medium mb-3">{step.title}</h3>
                <p className="text-[13px] leading-relaxed text-[#8B8D97] flex-1">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Metrics */}
      <section className="border-t border-white/[0.06] px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <p className="text-[12px] uppercase tracking-widest text-[#555] mb-3">
            Economics
          </p>
          <h2 className="text-[24px] font-semibold tracking-tight mb-12">
            Sub-cent viability, zero gas overhead
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {metrics.map((m) => (
              <div key={m.label} className="border border-white/[0.06] rounded-xl p-6">
                <div className="text-[28px] font-semibold font-[family-name:var(--font-geist-mono)] tabular-nums mb-1">
                  {m.value}
                </div>
                <div className="text-[12px] text-[#8B8D97]">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Preview */}
      <section className="border-t border-white/[0.06] px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <p className="text-[12px] uppercase tracking-widest text-[#555] mb-3">
            Architecture
          </p>
          <h2 className="text-[24px] font-semibold tracking-tight mb-12">
            Five agents, one pipeline
          </h2>

          <div className="flex items-center justify-center gap-0 overflow-x-auto py-4">
            {[
              { name: "Orchestrator", role: "Task decomposition" },
              { name: "Data Agent", role: "AIsa + Featherless AI" },
              { name: "Compute", role: "Gemini 2.5 Flash" },
              { name: "Validator", role: "ERC-8004 scoring" },
              { name: "Treasury", role: "Budget enforcement" },
            ].map((agent, i, arr) => (
              <div key={agent.name} className="flex items-center shrink-0">
                <div className="border border-white/[0.08] rounded-lg px-5 py-4 bg-white/[0.02] min-w-[130px] text-center">
                  <div className="text-[13px] font-medium mb-0.5">{agent.name}</div>
                  <div className="text-[11px] text-[#555]">{agent.role}</div>
                </div>
                {i < arr.length - 1 && (
                  <div className="w-10 h-px bg-white/[0.12] relative mx-1 shrink-0 flow-line">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent border-l-[5px] border-l-white/[0.2]" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="border-t border-white/[0.06] px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <p className="text-[12px] uppercase tracking-widest text-[#555] mb-6">
            Built with
          </p>
          <div className="flex flex-wrap gap-2">
            {techStack.map((tech) => (
              <span
                key={tech}
                className="px-3 py-1.5 border border-white/[0.06] rounded-md text-[12px] text-[#8B8D97] bg-white/[0.01]"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] px-6 py-8 mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-[12px] text-[#555]">
          <span>
            Built for{" "}
            <span className="text-[#8B8D97]">
              Agentic Economy on Arc Hackathon 2026
            </span>
          </span>
          <div className="flex items-center gap-6">
            <a href="https://docs.arc.network" target="_blank" rel="noopener noreferrer" className="hover:text-[#8B8D97] transition-colors">
              Arc Docs
            </a>
            <a href="https://developers.circle.com/gateway/nanopayments" target="_blank" rel="noopener noreferrer" className="hover:text-[#8B8D97] transition-colors">
              Nanopayments
            </a>
            <a href="https://www.x402.org" target="_blank" rel="noopener noreferrer" className="hover:text-[#8B8D97] transition-colors">
              x402
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
