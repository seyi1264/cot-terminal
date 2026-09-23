import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type MarketCandle = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type MarketTimeframe = "monthly" | "weekly" | "daily" | "fourHour" | "oneHour";

export type MarketTimeframes = Record<MarketTimeframe, MarketCandle[]>;

const TIMEFRAME_CONFIG: Record<MarketTimeframe, { interval: string; range: string }> = {
  monthly: { interval: "1mo", range: "max" },
  weekly: { interval: "1wk", range: "10y" },
  daily: { interval: "1d", range: "10y" },
  fourHour: { interval: "1h", range: "2y" },
  oneHour: { interval: "1h", range: "6mo" },
};

async function fetchMarketCandles(symbol: string, timeframe: MarketTimeframe): Promise<MarketCandle[]> {
  const config = TIMEFRAME_CONFIG[timeframe];
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("range", config.range);
  url.searchParams.set("interval", config.interval);
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "OakLedger/1.0" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Price ${timeframe} source ${response.status}`);
  const json = (await response.json()) as {
    chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ open?: Array<number | null>; high?: Array<number | null>; low?: Array<number | null>; close?: Array<number | null> }> } }> };
  };
  const result = json.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  const opens = quote?.open ?? [];
  const highs = quote?.high ?? [];
  const lows = quote?.low ?? [];
  const closes = quote?.close ?? [];
  const candles = timestamps.flatMap((timestamp, index) => {
    const open = opens[index];
    const high = highs[index];
    const low = lows[index];
    const close = closes[index];
    return [open, high, low, close].every((value) => typeof value === "number" && Number.isFinite(value))
      ? [{ date: new Date(timestamp * 1000).toISOString(), open: open as number, high: high as number, low: low as number, close: close as number }]
      : [];
  });
  if (timeframe !== "fourHour") return candles;
  const buckets = new Map<number, MarketCandle>();
  for (const candle of candles) {
    const timestamp = new Date(candle.date).getTime();
    const bucket = Math.floor(timestamp / (4 * 60 * 60 * 1000)) * (4 * 60 * 60 * 1000);
    const current = buckets.get(bucket);
    if (!current) buckets.set(bucket, { ...candle, date: new Date(bucket).toISOString() });
    else buckets.set(bucket, { ...current, high: Math.max(current.high, candle.high), low: Math.min(current.low, candle.low), close: candle.close });
  }
  return [...buckets.values()].sort((left, right) => left.date.localeCompare(right.date));
}

export const getMarketPrice = createServerFn({ method: "POST" })
  .validator(z.object({ symbol: z.string().min(1).max(20) }))
  .handler(async ({ data }) => {
    const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(data.symbol)}`);
    url.searchParams.set("range", "5d");
    url.searchParams.set("interval", "1d");
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "OakLedger/1.0" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Price source ${response.status}`);
    const json = (await response.json()) as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; regularMarketTime?: number }; timestamp?: number[]; indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> };
    };
    const result = json.chart?.result?.[0];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const closeIndex = [...closes].map((value, index) => (value == null ? -1 : index)).at(-1) ?? -1;
    const close = closeIndex >= 0 ? closes[closeIndex] : result?.meta?.regularMarketPrice;
    if (typeof close !== "number" || !Number.isFinite(close)) throw new Error("Price close unavailable");
    const timestamp = result?.timestamp?.[closeIndex] ?? result?.meta?.regularMarketTime;
    return { close, date: timestamp ? new Date(timestamp * 1000).toISOString().slice(0, 10) : "" };
  });

export const getMarketHistory = createServerFn({ method: "POST" })
  .validator(z.object({ symbol: z.string().min(1).max(20) }))
  .handler(async ({ data }) => {
    const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(data.symbol)}`);
    url.searchParams.set("period1", String(Math.floor(new Date("1980-01-01T00:00:00Z").getTime() / 1000)));
    url.searchParams.set("period2", String(Math.floor(Date.now() / 1000)));
    url.searchParams.set("interval", "1wk");
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "OakLedger/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Price history ${response.status}`);
    const json = (await response.json()) as {
      chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ open?: Array<number | null>; high?: Array<number | null>; low?: Array<number | null>; close?: Array<number | null> }> } }> };
    };
    const result = json.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const quote = result?.indicators?.quote?.[0];
    const opens = quote?.open ?? [];
    const highs = quote?.high ?? [];
    const lows = quote?.low ?? [];
    const closes = quote?.close ?? [];
    return timestamps.flatMap((timestamp, index) => {
      const open = opens[index];
      const high = highs[index];
      const low = lows[index];
      const close = closes[index];
      return [open, high, low, close].every((value) => typeof value === "number" && Number.isFinite(value))
        ? [{ date: new Date(timestamp * 1000).toISOString().slice(0, 10), open: open as number, high: high as number, low: low as number, close: close as number }]
        : [];
    });
  });

export const getMarketTimeframes = createServerFn({ method: "POST" })
  .validator(z.object({ symbol: z.string().min(1).max(20) }))
  .handler(async ({ data }): Promise<MarketTimeframes> => {
    const entries = await Promise.all(
      (Object.keys(TIMEFRAME_CONFIG) as MarketTimeframe[]).map(async (timeframe) => [timeframe, await fetchMarketCandles(data.symbol, timeframe)] as const),
    );
    return Object.fromEntries(entries) as MarketTimeframes;
  });

export async function fetchIntradayPrice(symbol: string) {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("range", "1d");
  url.searchParams.set("interval", "15m");
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "OakLedger/1.0" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Intraday price source ${response.status}`);
  const json = (await response.json()) as {
    chart?: { result?: Array<{ meta?: { regularMarketPrice?: number }; timestamp?: number[]; indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> };
  };
  const result = json.chart?.result?.[0];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const closeIndex = [...closes].map((value, index) => (value == null ? -1 : index)).at(-1) ?? -1;
  const close = closeIndex >= 0 ? closes[closeIndex] : result?.meta?.regularMarketPrice;
  if (typeof close !== "number" || !Number.isFinite(close)) throw new Error("Intraday price unavailable");
  const timestamp = result?.timestamp?.[closeIndex];
  return { close, timestamp: timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString() };
}