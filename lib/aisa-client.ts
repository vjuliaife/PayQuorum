/**
 * AIsa API Client — Real financial data endpoints.
 *
 * Base URL: https://api.aisa.one/apis/v1/
 * Auth: Bearer token (AISA_API_KEY)
 *
 * Verified from: github.com/AIsa-team/API-reference-docs
 * and github.com/AIsa-team/agent-skills/marketpulse
 */
import { config } from "./config";

const BASE_URL = config.aisaBaseUrl;

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (config.aisaApiKey) {
    h["Authorization"] = `Bearer ${config.aisaApiKey}`;
  }
  return h;
}

export async function fetchStockPrices(
  ticker: string,
  interval: "day" | "week" | "month" = "day",
  startDate: string,
  endDate: string,
): Promise<unknown> {
  const params = new URLSearchParams({
    ticker, interval, interval_multiplier: "1", start_date: startDate, end_date: endDate,
  });
  const res = await fetch(`${BASE_URL}/financial/prices?${params}`, { headers: headers() });
  if (!res.ok) throw new Error(`AIsa prices: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchCompanyNews(ticker: string, limit = 10): Promise<unknown> {
  const params = new URLSearchParams({ ticker, limit: String(limit) });
  const res = await fetch(`${BASE_URL}/financial/news?${params}`, { headers: headers() });
  if (!res.ok) throw new Error(`AIsa news: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchMetricsSnapshot(ticker: string): Promise<unknown> {
  const params = new URLSearchParams({ ticker });
  const res = await fetch(`${BASE_URL}/financial/financial-metrics/snapshot?${params}`, { headers: headers() });
  if (!res.ok) throw new Error(`AIsa metrics: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchAnalystEstimates(
  ticker: string,
  period: "annual" | "quarterly" = "annual",
): Promise<unknown> {
  const params = new URLSearchParams({ ticker, period });
  const res = await fetch(`${BASE_URL}/financial/analyst-estimates?${params}`, { headers: headers() });
  if (!res.ok) throw new Error(`AIsa estimates: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchIncomeStatements(
  ticker: string,
  period: "annual" | "quarterly" = "annual",
): Promise<unknown> {
  const params = new URLSearchParams({ ticker, period });
  const res = await fetch(`${BASE_URL}/financial/financials/income-statements?${params}`, { headers: headers() });
  if (!res.ok) throw new Error(`AIsa income: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchInsiderTrades(ticker: string): Promise<unknown> {
  const params = new URLSearchParams({ ticker });
  const res = await fetch(`${BASE_URL}/financial/insider-trades?${params}`, { headers: headers() });
  if (!res.ok) throw new Error(`AIsa insider trades: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function smartSearch(query: string): Promise<unknown> {
  const params = new URLSearchParams({ q: query });
  const res = await fetch(`${BASE_URL}/search-smart?${params}`, { headers: headers() });
  if (!res.ok) throw new Error(`AIsa search: ${res.status} ${res.statusText}`);
  return res.json();
}
