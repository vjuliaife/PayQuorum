import { GoogleGenAI } from "@google/genai";
import { BaseAgent } from "./base-agent";
import { AgentRole, type AgentConfig, type SubTask } from "./types";

/**
 * ComputeAgent — Analyzes financial data using Google Gemini 2.5 Flash.
 *
 * Uses the real @google/genai SDK (npm) to call Gemini for financial analysis.
 * Falls back to local heuristic analysis if GEMINI_API_KEY is not configured.
 *
 * Each analysis step is a billable compute unit ($0.002 USDC).
 * Gemini model: gemini-2.5-flash (best price-performance for hackathon).
 */

let gemini: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI | null {
  if (gemini) return gemini;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  gemini = new GoogleGenAI({ apiKey: key });
  return gemini;
}

export class ComputeAgent extends BaseAgent {
  private computeUnits = 0;
  private totalEarned = 0n;

  constructor(agentConfig: AgentConfig) {
    super({ ...agentConfig, role: AgentRole.Compute });
  }

  async initialize(): Promise<void> {
    this.log(`Initialized at ${this.address}`);
    const hasGemini = !!process.env.GEMINI_API_KEY;
    this.log(`Gemini: ${hasGemini ? "enabled (gemini-2.5-flash)" : "disabled (using local analysis)"}`);
    this.emit("agent:initialized", { role: this.role, address: this.address, gemini: hasGemini });
  }

  async executeSubtask(subtask: SubTask, inputData: unknown): Promise<unknown> {
    this.log(`Processing: ${subtask.description}`);

    const data = inputData as { sources: Array<{ source: string; data: unknown; cost: number }>; summary?: string };
    const analyses: Array<Record<string, unknown>> = [];

    for (const source of data.sources) {
      this.computeUnits++;
      const unitCost = 2000n; // $0.002 per compute unit
      this.totalEarned += unitCost;

      const analysis = await this.analyze(source.source, source.data);
      analyses.push(analysis);

      this.recordPayment({
        from: "requester", to: this.address,
        amount: unitCost, taskId: subtask.parentTaskId,
        subtaskId: subtask.id, timestamp: Date.now(),
        type: "compute_fee",
      });

      this.emit("agent:action", {
        action: analysis.analyzedBy === "gemini-2.5-flash" ? "gemini_analysis" : "local_analysis",
        model: analysis.analyzedBy,
        unit: this.computeUnits,
        source: source.source,
        cost: Number(unitCost) / 1e6,
      });

      await new Promise((r) => setTimeout(r, 30));
    }

    const result = {
      summary: `Analyzed ${analyses.length} data sources`,
      computeUnits: this.computeUnits,
      results: analyses,
      confidence: this.calculateConfidence(analyses),
      timestamp: Date.now(),
      featherlessSummary: data.summary || null,
    };

    this.log(`Complete: ${this.computeUnits} units | earned ${Number(this.totalEarned) / 1e6} USDC`);
    return result;
  }

  private async analyze(source: string, data: unknown): Promise<Record<string, unknown>> {
    const ai = getGemini();
    const raw = data as Record<string, unknown>;
    const dataPoints = typeof raw === "object" && raw ? Object.keys(raw).length : 0;
    const hasRealData = raw && !("error" in raw) && !("fallback" in raw);

    // Try Gemini first
    if (ai && hasRealData) {
      try {
        const prompt = `You are a financial analysis agent. Analyze this data and respond ONLY with valid JSON (no markdown, no explanation).
Format: {"riskScore": <0-100>, "trend": "<bullish|neutral|cautious>", "recommendation": "<favorable|neutral|cautious>", "insight": "<1 sentence>"}

Data source: ${source}
Data: ${JSON.stringify(raw).slice(0, 2000)}`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });

        const text = response.text?.trim() || "";
        // Extract JSON from response (handle potential markdown wrapping)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            source,
            dataPointsProcessed: dataPoints,
            riskScore: Math.max(0, Math.min(100, parsed.riskScore || 50)),
            trend: parsed.trend || "neutral",
            recommendation: parsed.recommendation || "neutral",
            insight: parsed.insight || "",
            analyzedBy: "gemini-2.5-flash",
            processedAt: Date.now(),
          };
        }
      } catch (error) {
        this.log(`Gemini analysis failed for ${source}, using fallback: ${error}`);
      }
    }

    // Fallback: local heuristic analysis
    return this.localAnalysis(source, raw, dataPoints);
  }

  private localAnalysis(source: string, raw: Record<string, unknown>, dataPoints: number): Record<string, unknown> {
    let riskScore = 50;
    let trend = "neutral";

    if (source === "Stock Prices" && raw && !("error" in raw)) {
      riskScore = 30 + Math.floor(Math.random() * 40);
      trend = riskScore < 50 ? "bullish" : "cautious";
    } else if (source === "Financial Metrics" && raw && !("error" in raw)) {
      riskScore = 20 + Math.floor(Math.random() * 30);
      trend = "data-driven";
    } else if (source === "Company News" && raw && !("error" in raw)) {
      riskScore = 40 + Math.floor(Math.random() * 20);
      trend = "sentiment-based";
    }

    return {
      source,
      dataPointsProcessed: dataPoints,
      riskScore,
      trend,
      recommendation: riskScore < 40 ? "favorable" : riskScore < 60 ? "neutral" : "cautious",
      analyzedBy: "local-heuristic",
      processedAt: Date.now(),
    };
  }

  private calculateConfidence(analyses: Array<Record<string, unknown>>): number {
    if (analyses.length === 0) return 0;
    const avgRisk = analyses.reduce((sum, a) => sum + (a.riskScore as number), 0) / analyses.length;
    const geminiCount = analyses.filter(a => a.analyzedBy === "gemini-2.5-flash").length;
    // Higher confidence when Gemini is used and risk is moderate
    const geminiBonus = geminiCount > 0 ? 0.15 : 0;
    return Math.min(0.95, 0.5 + (analyses.length * 0.1) + (1 - Math.abs(avgRisk - 50) / 100) * 0.2 + geminiBonus);
  }

  override getStats() {
    return {
      ...super.getStats(),
      computeUnits: this.computeUnits,
      totalEarned: Number(this.totalEarned) / 1e6,
      model: process.env.GEMINI_API_KEY ? "gemini-2.5-flash" : "local-heuristic",
    };
  }
}
