import { INSTRUMENTS } from "./instruments";
import { analyzeBoard, lagNote } from "./white-oak";
import type { CotBoard, CotRawRow } from "./types";

const CFTC_URL = "https://publicreporting.cftc.gov/resource/6dca-aqww.json";
const SELECT = [
  "cftc_contract_market_code",
  "report_date_as_yyyy_mm_dd",
  "open_interest_all",
  "noncomm_positions_long_all",
  "noncomm_positions_short_all",
  "noncomm_postions_spread_all",
  "comm_positions_long_all",
  "comm_positions_short_all",
  "nonrept_positions_long_all",
  "nonrept_positions_short_all",
  "change_in_open_interest_all",
  "change_in_noncomm_long_all",
  "change_in_noncomm_short_all",
  "change_in_comm_long_all",
  "change_in_comm_short_all",
  "change_in_nonrept_long_all",
  "change_in_nonrept_short_all",
].join(",");

const LOOKBACK_START = "1986-01-01";
const ROW_LIMIT = "50000";

function coerceRows(raw: unknown[]): CotRawRow[] {
  return raw.map((item) => {
    const row = item as Record<string, unknown>;
    const n = (k: string) => {
      const v = row[k];
      if (typeof v === "number") return v;
      if (typeof v === "string" && v !== "") {
        const parsed = Number(v);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };
    return {
      cftc_contract_market_code: String(row.cftc_contract_market_code ?? ""),
      report_date_as_yyyy_mm_dd: String(row.report_date_as_yyyy_mm_dd ?? "").slice(0, 10),
      open_interest_all: n("open_interest_all"),
      noncomm_positions_long_all: n("noncomm_positions_long_all"),
      noncomm_positions_short_all: n("noncomm_positions_short_all"),
      noncomm_postions_spread_all: n("noncomm_postions_spread_all"),
      comm_positions_long_all: n("comm_positions_long_all"),
      comm_positions_short_all: n("comm_positions_short_all"),
      nonrept_positions_long_all: n("nonrept_positions_long_all"),
      nonrept_positions_short_all: n("nonrept_positions_short_all"),
      change_in_open_interest_all: n("change_in_open_interest_all"),
      change_in_noncomm_long_all: n("change_in_noncomm_long_all"),
      change_in_noncomm_short_all: n("change_in_noncomm_short_all"),
      change_in_comm_long_all: n("change_in_comm_long_all"),
      change_in_comm_short_all: n("change_in_comm_short_all"),
      change_in_nonrept_long_all: n("change_in_nonrept_long_all"),
      change_in_nonrept_short_all: n("change_in_nonrept_short_all"),
    };
  });
}

function boardFromRows(rows: CotRawRow[]): CotBoard {
  const instruments = analyzeBoard(rows);
  const asOf = instruments.reduce((latest, row) => (row.asOf > latest ? row.asOf : latest), "");
  return {
    asOf,
    fetchedAt: new Date().toISOString(),
    source: "live",
    lagNote: lagNote(asOf || "the latest Tuesday"),
    instruments,
  };
}

async function fetchLive(): Promise<CotRawRow[]> {
  const codes = INSTRUMENTS.map((i) => `'${i.code}'`).join(",");
  const where = `cftc_contract_market_code in (${codes}) AND report_date_as_yyyy_mm_dd >= '${LOOKBACK_START}'`;
  const url = new URL(CFTC_URL);
  url.searchParams.set("$select", SELECT);
  url.searchParams.set("$where", where);
  url.searchParams.set("$order", "report_date_as_yyyy_mm_dd DESC");
  url.searchParams.set("$limit", ROW_LIMIT);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "OakLedger/1.0 (institutional COT terminal)",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`CFTC ${response.status}`);
  }
  const json: unknown = await response.json();
  if (!Array.isArray(json) || json.length < 100) {
    throw new Error("CFTC payload too small");
  }
  return coerceRows(json);
}

export async function loadBoard(_force = false): Promise<CotBoard> {
  try {
    const rows = await fetchLive();
    return boardFromRows(rows);
  } catch (err) {
    console.error("[cot] live CFTC fetch failed; no data loaded", err);
    return {
      asOf: "",
      fetchedAt: new Date().toISOString(),
      source: "unavailable",
      lagNote: "Live CFTC data is unavailable. No cached positioning data was loaded.",
      instruments: [],
    };
  }
}
