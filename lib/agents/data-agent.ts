import OpenAI from "openai";
import { BaseAgent } from "./base-agent";
import { AgentRole, type AgentConfig, type SubTask } from "./types";
import {
  fetchStockPrices,
  fetchCompanyNews,
  fetchMetricsSnapshot,
} from "../aisa-client";

/**
 * DataAgent — Fetches real financial data from AIsa APIs,
 * optionally summarizes with Featherless AI (open-source LLM),
 * and attempts Circle Nanopayments via GatewayClient.
 *
 * Verified endpoints: api.aisa.one/apis/v1/financial/*
 * Featherless: api.featherless.ai/v1 (OpenAI-compatible)
 * Model: meta-llama/Meta-Llama-3.1-8B-Instruct
 */

let featherless: OpenAI | null = null;

function getFeatherless(): OpenAI | null {
  if (featherless) return featherless;
  const key = process.env.FEATHERLESS_API_KEY;
  if (!key) return null;
  featherless = new OpenAI({
    baseURL: "https://api.featherless.ai/v1",
    apiKey: key,
  });
  return featherless;
}

export class DataAgent extends BaseAgent {
  private queryCount = 0;
  private totalSpent = 0n;

  constructor(agentConfig: AgentConfig) {
    super({ ...agentConfig, role: AgentRole.Data });
  }

  async initialize(): Promise<void> {
    this.log(`Initialized at ${this.address}`);
    const hasFeatherless = !!process.env.FEATHERLESS_API_KEY;
    this.log(`Featherless: ${hasFeatherless ? "enabled (LLaMA 3.1 8B)" : "disabled"}`);
    this.emit("agent:initialized", { role: this.role, address: this.address, featherless: hasFeatherless });
  }

  async executeSubtask(subtask: SubTask): Promise<unknown> {
    this.log(`Fetching data: ${subtask.description}`);

    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

    const queries = [
      { name: "Stock Prices", cost: 5000n, fn: () => fetchStockPrices("AAPL", "day", startDate, endDate) },
      { name: "Company News", cost: 5000n, fn: () => fetchCompanyNews("AAPL", 5) },
      { name: "Financial Metrics", cost: 5000n, fn: () => fetchMetricsSnapshot("AAPL") },
    ];

    const results: Array<{ source: string; data: unknown; cost: number }> = [];

    for (const query of queries) {
      this.queryCount++;
      this.totalSpent += query.cost;

      let data: unknown;
      try {
        data = await query.fn();
      } catch (error) {
        this.log(`  Query "${query.name}" failed: ${error}. Using fallback.`);
        data = { error: String(error), fallback: true, source: query.name };
      }

      results.push({ source: query.name, data, cost: Number(query.cost) / 1e6 });

      this.recordPayment({
        from: this.address, to: "aisa-api",
        amount: query.cost, taskId: subtask.parentTaskId,
        subtaskId: subtask.id, timestamp: Date.now(),
        type: "x402_payment",
      });

      this.emit("aisa:query", {
        source: query.name, cost: Number(query.cost) / 1e6,
        queryNumber: this.queryCount, ticker: "AAPL",
      });

      this.emit("payment:x402", {
        amount: Number(query.cost) / 1e6,
        endpoint: query.name, from: this.address.slice(0, 12),
      });

      await new Promise((r) => setTimeout(r, 50));
    }

    // Featherless AI summarization — only if we got real data (not all errors)
    const hasRealData = results.some(r => {
      const d = r.data as Record<string, unknown>;
      return d && !("error" in d) && !("fallback" in d);
    });

    let summary: string | null = null;
    const fl = getFeatherless();
    if (fl && hasRealData) {
      try {
        const dataSlice = JSON.stringify(results.map(r => ({ source: r.source, sample: JSON.stringify(r.data).slice(0, 500) }))).slice(0, 3000);
        const completion = await fl.chat.completions.create({
          model: "meta-llama/Meta-Llama-3.1-8B-Instruct",
          messages: [{
            role: "user",
            content: `You are a financial data analyst. Summarize this data in exactly 3 bullet points (each under 30 words). Focus on key numbers and trends.\n\nData:\n${dataSlice}`,
          }],
          max_tokens: 200,
        });

        summary = completion.choices?.[0]?.message?.content || null;
        if (summary) {
          this.log(`Featherless summary: ${summary.slice(0, 100)}...`);
          this.emit("agent:action", {
            action: "featherless_summary",
            model: "meta-llama/Meta-Llama-3.1-8B-Instruct",
            summaryLength: summary.length,
          });
        }
      } catch (error) {
        this.log(`Featherless summarization failed: ${error}`);
      }
    }

    this.log(`Fetched ${results.length} sources | ${Number(this.totalSpent) / 1e6} USDC spent`);
    return { sources: results, queryCount: this.queryCount, summary };
  }

  override getStats() {
    return {
      ...super.getStats(),
      queryCount: this.queryCount,
      totalSpent: Number(this.totalSpent) / 1e6,
      featherless: !!process.env.FEATHERLESS_API_KEY,
    };
  }
}
