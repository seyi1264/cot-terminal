import { createFileRoute } from "@tanstack/react-router";
import { INSTRUMENT_BY_CODE } from "@/lib/cot/instruments";
import { fetchIntradayPrice } from "@/lib/cot/price.functions";
import { sendPushToUsers } from "@/lib/cot/push.functions";

const PRICE_SYMBOLS: Record<string, string> = {
  EURUSD: "EURUSD=X", GBPUSD: "GBPUSD=X", USDJPY: "JPY=X", AUDUSD: "AUDUSD=X", USDCAD: "CAD=X",
  USDCHF: "CHF=X", NZDUSD: "NZDUSD=X", USDMXN: "MXN=X", DXY: "DX-Y.NYB", XAUUSD: "GC=F", XAGUSD: "SI=F",
  HG: "HG=F", CL: "CL=F", NG: "NG=F", ES: "ES=F", NQ: "NQ=F", ZN: "ZN=F", ZB: "ZB=F", BTC: "BTC-USD",
};

type ZoneRow = {
  id: string;
  user_id: string;
  instrument_code: string;
  direction: "demand" | "supply";
  lower_price: string | number;
  upper_price: string | number;
  invalidation_price: string | number;
  alert_armed: boolean;
};

export const Route = createFileRoute("/api/push/zone-cron")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const expected = process.env.PUSH_CRON_SECRET?.trim();
        const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
        if (!expected || provided !== expected) return new Response("Unauthorized", { status: 401 });
        if (new Date().getUTCDay() !== 4) return Response.json({ ok: true, skipped: true, reason: "not-thursday" });

        const { getSql } = await import("@/lib/db");
        const sql = await getSql();
        const zones = await sql.query<ZoneRow>("select id, user_id, instrument_code, direction, lower_price, upper_price, invalidation_price, alert_armed from thesis_zones where active = true and quality <> 'removed' and alert_weekday = 4");
        const prices = new Map<string, number>();
        for (const zone of zones) {
          const pair = INSTRUMENT_BY_CODE[zone.instrument_code]?.pair;
          const symbol = pair ? PRICE_SYMBOLS[pair] : undefined;
          if (!symbol || prices.has(symbol)) continue;
          try { prices.set(symbol, (await fetchIntradayPrice(symbol)).close); } catch { /* skip an unavailable quote */ }
        }

        const alerts = new Map<string, string[]>();
        for (const zone of zones) {
          const pair = INSTRUMENT_BY_CODE[zone.instrument_code]?.pair;
          const symbol = pair ? PRICE_SYMBOLS[pair] : undefined;
          const price = symbol ? prices.get(symbol) : undefined;
          if (price == null) continue;
          const lower = Number(zone.lower_price);
          const upper = Number(zone.upper_price);
          const invalidated = zone.direction === "demand" ? price < Number(zone.invalidation_price) : price > Number(zone.invalidation_price);
          if (invalidated) {
            await sql.query("update thesis_zones set active = false, quality = 'removed', updated_at = now() where id = $1", [zone.id]);
            continue;
          }
          const inside = price >= lower && price <= upper;
          if (inside && zone.alert_armed) {
            const symbolLabel = INSTRUMENT_BY_CODE[zone.instrument_code]?.symbol ?? zone.instrument_code;
            const list = alerts.get(zone.user_id) ?? [];
            list.push(`${symbolLabel}: ${zone.direction} zone approached at ${price}`);
            alerts.set(zone.user_id, list);
            await sql.query("update thesis_zones set alert_armed = false, last_alerted_at = now(), last_alert_price = $1, updated_at = now() where id = $2", [price, zone.id]);
          } else if (!inside && !zone.alert_armed) {
            await sql.query("update thesis_zones set alert_armed = true, updated_at = now() where id = $1", [zone.id]);
          }
        }

        let sent = 0;
        for (const [userId, messages] of alerts) {
          const result = await sendPushToUsers([userId], JSON.stringify({ title: "Oak & Ledger · zone approach", body: messages.join("\n"), tag: "zone-approach" }));
          sent += result.sent;
        }
        return Response.json({ ok: true, zones: zones.length, alerts: alerts.size, sent });
      },
    },
  },
});