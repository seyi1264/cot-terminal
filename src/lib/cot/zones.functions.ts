import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { validateZonePrices } from "./zone-validation";

const directionSchema = z.enum(["demand", "supply"]);
const timeframeSchema = z.enum(["monthly", "daily", "weekly", "4hr", "1hr", "6M"]);
const qualitySchema = z.enum(["fresh", "tested", "removed"]);

const zoneInputSchema = z.object({
  instrumentCode: z.string().min(1).max(20),
  direction: directionSchema,
  timeframe: timeframeSchema,
  lowerPrice: z.number().finite().nonnegative(),
  upperPrice: z.number().finite().nonnegative(),
  invalidationPrice: z.number().finite().nonnegative(),
  quality: qualitySchema.default("fresh"),
  active: z.boolean().default(true),
}).superRefine((value, context) => {
  const error = validateZonePrices(value);
  if (error) context.addIssue({ code: "custom", path: [error.field], message: error.message });
});

const idSchema = z.object({ id: z.string().uuid() });

export type ThesisZone = {
  id: string;
  instrumentCode: string;
  direction: "demand" | "supply";
  timeframe: "monthly" | "daily" | "weekly" | "4hr" | "1hr" | "6M";
  lowerPrice: number;
  upperPrice: number;
  invalidationPrice: number;
  quality: "fresh" | "tested" | "removed";
  active: boolean;
  alertWeekday: number;
  lastAlertedAt: string | null;
  lastAlertPrice: number | null;
};

type ZoneRow = {
  id: string;
  instrument_code: string;
  direction: ThesisZone["direction"];
  timeframe: ThesisZone["timeframe"];
  lower_price: string | number;
  upper_price: string | number;
  invalidation_price: string | number;
  quality: ThesisZone["quality"];
  active: boolean;
  alert_weekday: number;
  last_alerted_at: string | null;
  last_alert_price: string | number | null;
};

function mapZone(row: ZoneRow): ThesisZone {
  return {
    id: row.id,
    instrumentCode: row.instrument_code,
    direction: row.direction,
    timeframe: row.timeframe,
    lowerPrice: Number(row.lower_price),
    upperPrice: Number(row.upper_price),
    invalidationPrice: Number(row.invalidation_price),
    quality: row.quality,
    active: row.active,
    alertWeekday: row.alert_weekday,
    lastAlertedAt: row.last_alerted_at,
    lastAlertPrice: row.last_alert_price == null ? null : Number(row.last_alert_price),
  };
}

export const listThesisZones = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql.query<ZoneRow>(
      "select id, instrument_code, direction, timeframe, lower_price, upper_price, invalidation_price, quality, active, alert_weekday, last_alerted_at, last_alert_price from thesis_zones where user_id = $1 order by active desc, updated_at desc",
      [context.userId],
    );
    return rows.map(mapZone);
  });

export const createThesisZone = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(zoneInputSchema)
  .handler(async ({ data, context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const id = crypto.randomUUID();
    const rows = await sql.query<ZoneRow>(
      "insert into thesis_zones (id, user_id, instrument_code, direction, timeframe, lower_price, upper_price, invalidation_price, quality, active) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id, instrument_code, direction, timeframe, lower_price, upper_price, invalidation_price, quality, active, alert_weekday, last_alerted_at, last_alert_price",
      [id, context.userId, data.instrumentCode, data.direction, data.timeframe, data.lowerPrice, data.upperPrice, data.invalidationPrice, data.quality, data.active],
    );
    return mapZone(rows[0]!);
  });

export const updateThesisZone = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idSchema.merge(zoneInputSchema))
  .handler(async ({ data, context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql.query<ZoneRow>(
      "update thesis_zones set instrument_code = $1, direction = $2, timeframe = $3, lower_price = $4, upper_price = $5, invalidation_price = $6, quality = $7, active = $8, updated_at = now() where id = $9 and user_id = $10 returning id, instrument_code, direction, timeframe, lower_price, upper_price, invalidation_price, quality, active, alert_weekday, last_alerted_at, last_alert_price",
      [data.instrumentCode, data.direction, data.timeframe, data.lowerPrice, data.upperPrice, data.invalidationPrice, data.quality, data.active, data.id, context.userId],
    );
    if (!rows[0]) throw new Error("Zone not found");
    return mapZone(rows[0]);
  });

export const removeThesisZone = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idSchema)
  .handler(async ({ data, context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql.query("update thesis_zones set quality = 'removed', active = false, updated_at = now() where id = $1 and user_id = $2", [data.id, context.userId]);
    return { ok: true };
  });
