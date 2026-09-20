import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
    url.searchParams.set("range", "5y");
    url.searchParams.set("interval", "1wk");
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "OakLedger/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Price history ${response.status}`);
    const json = (await response.json()) as {
      chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> };
    };
    const result = json.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    return timestamps.flatMap((timestamp, index) => {
      const close = closes[index];
      return typeof close === "number" && Number.isFinite(close)
        ? [{ date: new Date(timestamp * 1000).toISOString().slice(0, 10), close }]
        : [];
    });
  });