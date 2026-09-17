import { INSTRUMENTS, USD_BASE_PAIRS } from "./instruments";
import { formatContracts, formatSigned, stanceLabel } from "./format";
import type {
  CotRawRow,
  FlowKind,
  FlowReading,
  GroupPrint,
  GroupSnapshot,
  InstrumentReport,
  SeriesPoint,
  Stance,
  TraderGroup,
  WeeklyPrint,
} from "./types";

const SERIES_LOOKBACK = 156;
const AVG_WINDOW = 13;
const FLOW_EPS = 80;

function num(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function cotIndex(current: number, window: number[]): number {
  if (window.length === 0) return 50;
  let min = window[0]!;
  let max = window[0]!;
  for (const v of window) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (max === min) return 50;
  return ((current - min) / (max - min)) * 100;
}

function classifyFlow(
  dLong: number,
  dShort: number,
  dNet: number,
  net: number,
  group: TraderGroup,
): FlowReading {
  const mag = Math.max(Math.abs(dLong), Math.abs(dShort), Math.abs(dNet));
  if (mag < FLOW_EPS) {
    return labelFlow("unchanged", group);
  }
  if (dLong > FLOW_EPS && dShort > FLOW_EPS) {
    return labelFlow("two-way", group);
  }
  if (dLong < -FLOW_EPS && dShort < -FLOW_EPS) {
    return labelFlow("liquidation", group);
  }
  if (dNet > FLOW_EPS) {
    if (dLong > 0 && dShort <= FLOW_EPS) {
      return labelFlow(net >= 0 ? "accum-long" : "cover-short", group);
    }
    if (dShort < 0) return labelFlow("cover-short", group);
    return labelFlow("accum-long", group);
  }
  if (dNet < -FLOW_EPS) {
    if (dShort > 0 && dLong <= FLOW_EPS) {
      return labelFlow(net <= 0 ? "accum-short" : "fade-long", group);
    }
    if (dLong < 0) {
      return labelFlow(net > 0 ? "profit-long" : "accum-short", group);
    }
    return labelFlow("accum-short", group);
  }
  return labelFlow("unchanged", group);
}

function labelFlow(kind: FlowKind, group: TraderGroup): FlowReading {
  const raw: Record<FlowKind, string> = {
    "accum-long": "Accumulating longs",
    "accum-short": "Accumulating shorts",
    "profit-long": "Profit taking (longs)",
    "profit-short": "Profit taking (shorts)",
    "cover-short": "Covering shorts",
    "fade-long": "Fading the long",
    "two-way": "Both sides adding",
    liquidation: "Liquidating",
    unchanged: "Quiet",
  };
  const comm: Partial<Record<FlowKind, string>> = {
    "accum-short": "Hedging a rise",
    "accum-long": "Hedging a decline",
    "profit-short": "Unwinding upside hedges",
    "cover-short": "Unwinding upside hedges",
    "profit-long": "Unwinding downside hedges",
    "fade-long": "Hedging a decline",
    "two-way": "Book expanding",
    liquidation: "Book shrinking",
  };
  const label = raw[kind];
  const woLabel = group === "comm" ? (comm[kind] ?? label) : label;
  return { kind, label, woLabel };
}

function snapshot(
  prints: WeeklyPrint[],
  group: TraderGroup,
): GroupSnapshot {
  const latest = prints[prints.length - 1]!;
  const g = latest[group];
  const nets = prints.map((p) => p[group].net);
  const window = nets;
  const last13 = nets.slice(-AVG_WINDOW);
  const avg13 = mean(last13);
  const index = cotIndex(g.net, window);
  const minAll = Math.min(...window);
  const maxAll = Math.max(...window);
  const total = g.long + g.short;
  const oi = latest.oi || 1;
  return {
    long: g.long,
    short: g.short,
    spread: g.spread,
    net: g.net,
    total,
    pctOiLong: (g.long / oi) * 100,
    pctOiShort: (g.short / oi) * 100,
    dLong: g.dLong,
    dShort: g.dShort,
    dNet: g.dNet,
    index,
    avg13,
    vs13: g.net - avg13,
    minAll,
    maxAll,
    flow: classifyFlow(g.dLong, g.dShort, g.dNet, g.net, group),
  };
}

function rowsToPrints(rows: CotRawRow[]): WeeklyPrint[] {
  const sorted = [...rows].sort((a, b) =>
    dateOnly(a.report_date_as_yyyy_mm_dd).localeCompare(
      dateOnly(b.report_date_as_yyyy_mm_dd),
    ),
  );
  return sorted.map((row) => {
    const noncomm: GroupPrint = {
      long: num(row.noncomm_positions_long_all),
      short: num(row.noncomm_positions_short_all),
      spread: num(row.noncomm_postions_spread_all),
      net: 0,
      dLong: num(row.change_in_noncomm_long_all),
      dShort: num(row.change_in_noncomm_short_all),
      dNet: 0,
    };
    noncomm.net = noncomm.long - noncomm.short;
    noncomm.dNet = noncomm.dLong - noncomm.dShort;
    const comm: GroupPrint = {
      long: num(row.comm_positions_long_all),
      short: num(row.comm_positions_short_all),
      spread: 0,
      net: 0,
      dLong: num(row.change_in_comm_long_all),
      dShort: num(row.change_in_comm_short_all),
      dNet: 0,
    };
    comm.net = comm.long - comm.short;
    comm.dNet = comm.dLong - comm.dShort;
    const retail: GroupPrint = {
      long: num(row.nonrept_positions_long_all),
      short: num(row.nonrept_positions_short_all),
      spread: 0,
      net: 0,
      dLong: num(row.change_in_nonrept_long_all),
      dShort: num(row.change_in_nonrept_short_all),
      dNet: 0,
    };
    retail.net = retail.long - retail.short;
    retail.dNet = retail.dLong - retail.dShort;
    return {
      date: dateOnly(row.report_date_as_yyyy_mm_dd),
      oi: num(row.open_interest_all),
      oiChange: num(row.change_in_open_interest_all),
      noncomm,
      comm,
      retail,
      woDiff: noncomm.net - comm.net,
    };
  });
}

function scoreReading(
  woDiff: number,
  woIndex: number,
  nc: GroupSnapshot,
  comm: GroupSnapshot,
  retail: GroupSnapshot,
  retailDiverging: boolean,
): { score: number; stance: Stance; flags: string[] } {
  let score = 0;
  const flags: string[] = [];

  score += Math.sign(woDiff) * 2;
  if (woIndex >= 80) score += 2;
  else if (woIndex >= 65) score += 1;
  else if (woIndex <= 20) score -= 2;
  else if (woIndex <= 35) score -= 1;

  if (comm.index <= 20) {
    score += 2;
    flags.push("Commercials at an all-history short extreme — hedging a rise");
  } else if (comm.index >= 80) {
    score -= 2;
    flags.push("Commercials at an all-history long extreme — hedging a decline");
  }

  if (nc.index >= 80) {
    score += 1;
    flags.push("Non-commercials extremely long");
  } else if (nc.index <= 20) {
    score -= 1;
    flags.push("Non-commercials extremely short");
  }

  if (nc.flow.kind === "accum-long" || nc.flow.kind === "cover-short") score += 1;
  if (
    nc.flow.kind === "accum-short" ||
    nc.flow.kind === "profit-long" ||
    nc.flow.kind === "fade-long"
  ) {
    score -= 1;
  }
  if (comm.flow.kind === "accum-short") {
    score += 1;
    flags.push("Commercial accumulation (shorts / hedging a rise)");
  }
  if (comm.flow.kind === "accum-long") {
    score -= 1;
    flags.push("Commercial accumulation (longs / hedging a decline)");
  }

  if (nc.flow.kind === "profit-long" && nc.index >= 70) {
    flags.push("Profit taking: large specs cutting longs near an extreme");
  }
  if (nc.flow.kind === "profit-short" && nc.index <= 30) {
    flags.push("Profit taking: large specs covering shorts near an extreme");
  }

  if (retailDiverging) {
    flags.push(
      woDiff >= 0
        ? "Retail divergence — small specs fading the bid"
        : "Retail divergence — small specs chasing the offer",
    );
    score += woDiff >= 0 ? 1 : -1;
  }

  if (nc.index >= 90 || nc.index <= 10 || comm.index >= 90 || comm.index <= 10) {
    flags.push("Extreme reading — all-history range, profit-taking risk");
  }

  score = Math.max(-10, Math.min(10, score));
  let stance: Stance = "balanced";
  if (score >= 6) stance = "strong-bid";
  else if (score >= 3) stance = "bid";
  else if (score <= -6) stance = "strong-offer";
  else if (score <= -3) stance = "offer";
  return { score, stance, flags };
}

function invertPairLanguage(pair: string, stance: Stance): string {
  const label = stanceLabel(stance).toLowerCase();
  if (USD_BASE_PAIRS.has(pair)) {
    if (stance === "bid" || stance === "strong-bid") {
      return `${pair} offer (futures bid the foreign currency)`;
    }
    if (stance === "offer" || stance === "strong-offer") {
      return `${pair} bid (futures offered the foreign currency)`;
    }
  }
  return `${pair} ${label}`;
}

function narrative(
  def: (typeof INSTRUMENTS)[number],
  nc: GroupSnapshot,
  comm: GroupSnapshot,
  retail: GroupSnapshot,
  woDiff: number,
  woIndex: number,
  stance: Stance,
  flags: string[],
): { headline: string; body: string } {
  const pairRead = invertPairLanguage(def.pair, stance);
  const headline =
    def.pair === def.symbol
      ? `${def.symbol} — ${stanceLabel(stance).toLowerCase()}`
      : `${def.symbol} — ${pairRead}`;
  const extreme =
    woIndex >= 80 ? "stretched to the bid side of its all-history range" :
    woIndex <= 20 ? "stretched to the offer side of its all-history range" :
    woIndex >= 65 ? "leaning bid versus the all-history range" :
    woIndex <= 35 ? "leaning offer versus the all-history range" :
    "mid-range — not an extreme";

  const parts = [
    `Non-commercials are net ${formatSigned(nc.net)} and ${nc.flow.label.toLowerCase()} this week (${formatSigned(nc.dNet)}).`,
    `Commercials are net ${formatSigned(comm.net)} — ${comm.flow.woLabel.toLowerCase()} (${formatSigned(comm.dNet)}).`,
    `Retail (non-reportable) sits net ${formatSigned(retail.net)}, ${retail.flow.label.toLowerCase()}.`,
    `White Oak difference (large-spec net minus commercial net) is ${formatSigned(woDiff)}, index ${woIndex.toFixed(0)} — ${extreme}.`,
  ];
  if (flags[0]) parts.push(flags[0] + ".");
  parts.push(
    "This is positioning context, not a trigger: confirm against the chart's demand and supply before acting.",
  );
  return { headline, body: parts.join(" ") };
}

export function analyzeInstrument(
  def: (typeof INSTRUMENTS)[number],
  rows: CotRawRow[],
): InstrumentReport | null {
  const prints = rowsToPrints(rows);
  if (prints.length < 8) return null;
  const latest = prints[prints.length - 1]!;
  const prev = prints[prints.length - 2];
  const nc = snapshot(prints, "noncomm");
  const comm = snapshot(prints, "comm");
  const retail = snapshot(prints, "retail");
  const woDiff = latest.woDiff;
  const woDiffChange = prev ? woDiff - prev.woDiff : 0;
  const woWindow = prints.map((p) => p.woDiff);
  const woIndex = cotIndex(woDiff, woWindow);
  const woAvg13 = mean(prints.slice(-AVG_WINDOW).map((p) => p.woDiff));
  const retailDiverging =
    Math.sign(retail.net) !== 0 && Math.sign(retail.net) !== Math.sign(woDiff || nc.net);

  const { score, stance, flags } = scoreReading(
    woDiff,
    woIndex,
    nc,
    comm,
    retail,
    retailDiverging,
  );
  const { headline, body } = narrative(def, nc, comm, retail, woDiff, woIndex, stance, flags);

  const series: SeriesPoint[] = prints.slice(-SERIES_LOOKBACK).map((p) => ({
    d: p.date,
    n: p.noncomm.net,
    c: p.comm.net,
    r: p.retail.net,
    w: p.woDiff,
    o: p.oi,
  }));

  return {
    code: def.code,
    symbol: def.symbol,
    name: def.name,
    pair: def.pair,
    category: def.category,
    exchange: def.exchange,
    asOf: latest.date,
    oi: latest.oi,
    oiChange: latest.oiChange,
    noncomm: nc,
    comm,
    retail,
    woDiff,
    woDiffChange,
    woIndex,
    woAvg13,
    stance,
    score,
    headline,
    body,
    flags,
    series,
  };
}

export function analyzeBoard(rows: CotRawRow[]): InstrumentReport[] {
  const byCode = new Map<string, CotRawRow[]>();
  for (const row of rows) {
    const code = row.cftc_contract_market_code;
    const list = byCode.get(code);
    if (list) list.push(row);
    else byCode.set(code, [row]);
  }
  const reports: InstrumentReport[] = [];
  for (const def of INSTRUMENTS) {
    const group = byCode.get(def.code);
    if (!group) continue;
    const report = analyzeInstrument(def, group);
    if (report) reports.push(report);
  }
  return reports;
}

export function lagNote(asOf: string): string {
  return `Positions as of ${asOf} (Tuesday). CFTC publishes the following Friday — a standing three-day lag.`;
}

export function formatNet(value: number): string {
  return formatContracts(value);
}
