import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getMarketPrice = createServerFn({ method: "POST" })
  .validator(z.object({ symbol: z.string().min(1).max(20) }))
  .handler(async ({ data }) => {
    const response = await fetch(`https://stooq.com/q/d/l/?s=${encodeURIComponent(data.symbol)}&i=d`, {
      headers: { Accept: "text/csv" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Price source ${response.status}`);
    const lines = (await response.text()).trim().split(/\r?\n/).slice(1).filter(Boolean);
    const row = lines.at(-1)?.split(",");
    if (!row || row.length < 5) throw new Error("Price payload unavailable");
    const close = Number(row[4]);
    if (!Number.isFinite(close)) throw new Error("Price close unavailable");
    return { close, date: row[0] ?? "" };
  });