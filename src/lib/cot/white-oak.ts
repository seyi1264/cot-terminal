import { INSTRUMENTS, stanceInPairQuote, USD_BASE_PAIRS } from "./instruments.ts";
import { formatContracts, formatSigned, stanceLabel } from "./format.ts";
import type {
  CotRawRow,
  FlowKind,
  FlowReading,
  GroupPrint,
  GroupSnapshot,
  InstrumentReport,
  SeriesPoint,
  Stance,
  ThesisStatus,
  TriggerLogic,
  TraderGroup,
  WeeklyPrint,
} from "./types.ts";

const AVG_WINDOW = 13;
const FLOW_EPS = 80;

export function isDistributionSetup(
  woDiff: number,
  nc: GroupSnapshot,
  comm: GroupSnapshot,
  retail: GroupSnapshot,
): boolean {
  return comm.net < 0 && nc.net > 0 && retail.net > 0 && woDiff > 0 && comm.index <= 35 && nc.index >= 65;
}

export function hasCommercialExitContext(
  comm: Pick<GroupSnapshot, "net" | "dNet">,
  woDiff: number,
  oiChange: number,
  series: Array<Pick<SeriesPoint, "w">>,
): boolean {
  const latestWo = series.at(-1)?.w ?? woDiff;
  const recentPositioningPeak = Math.max(...series.slice(-13, -1).map((point) => point.w));
  return comm.net < 0 && comm.dNet > 0 && latestWo < recentPositioningPeak && oiChange < 0;
}

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

export type OIContextInput = {
  oiChange: number;
  cotPeriodPriceChange?: number | null;
  commercialNet: number;
  woDiff: number;
};

export type OIContextRead = {
  label: string;
  tone: "strong-bid" | "bid" | "cautious" | "offer" | "strong-offer" | "neutral";
};

export function interpretOpenInterestContext({
  oiChange,
  cotPeriodPriceChange,
  commercialNet,
  woDiff,
}: OIContextInput): OIContextRead {
  if (cotPeriodPriceChange == null || !Number.isFinite(cotPeriodPriceChange)) {
    return {
      label: "Open interest changed, but price confirmation is unavailable; do not infer trend participation from positioning alone.",
      tone: "neutral",
    };
  }

  const priceUp = cotPeriodPriceChange > 0;
  const priceDown = cotPeriodPriceChange < 0;

  if (oiChange > 0 && priceUp) {
    const strong = commercialNet < 0 && woDiff > 0;
    return {
      label: strong
        ? "Rising OI with a price rise over the COT reporting interval supports trend participation, but aggregate OI cannot prove which side initiated positions."
        : "Rising OI with a price rise over the COT reporting interval shows participation expanded alongside price; it does not identify which side initiated positions.",
      tone: strong ? "strong-bid" : "bid",
    };
  }

  if (oiChange < 0 && priceUp) {
    return {
      label: "Falling OI with a price rise over the COT reporting interval is consistent with short covering; it does not prove the move is only covering or predict a fade.",
      tone: "cautious",
    };
  }

  if (oiChange > 0 && priceDown) {
    return {
      label: "Rising OI with a price decline over the COT reporting interval shows participation expanded alongside the decline; aggregate OI cannot identify which side initiated positions.",
      tone: "strong-offer",
    };
  }

  if (oiChange < 0 && priceDown) {
    return {
      label: "Falling OI with a price decline over the COT reporting interval is consistent with liquidation; it does not establish that the downtrend is exhausted.",
      tone: "offer",
    };
  }

  return {
    label: "Open interest is not yet decisive; treat the move as a setup until price and participation line up.",
    tone: "neutral",
  };
}

export function getCotPeriodPriceChange(
  candles: Array<{ date: string; close: number }>,
  previousCotDate: string | undefined,
  currentCotDate: string,
): number | null {
  if (!previousCotDate) return null;
  const closes = new Map(candles.map((candle) => [candle.date.slice(0, 10), candle.close]));
  const previousClose = closes.get(previousCotDate);
  const currentClose = closes.get(currentCotDate);
  if (
    previousClose === undefined || currentClose === undefined ||
    !Number.isFinite(previousClose) || !Number.isFinite(currentClose)
  ) return null;
  return currentClose - previousClose;
}

export type RetailDivergenceInput = {
  retailNet: number;
  retailIndex: number;
  woDiff: number;
  stance: Stance;
  priceChange?: number;
};

export type RetailDivergenceRead = {
  label: string;
  tone: "warning" | "caution" | "neutral";
};

export function summarizeRetailDivergence({
  retailNet,
  retailIndex,
  woDiff,
  stance,
  priceChange = 0,
}: RetailDivergenceInput): RetailDivergenceRead {
  const aggressiveLong = retailNet > 0 && retailIndex >= 75 && woDiff < 0;
  const aggressiveShort = retailNet < 0 && retailIndex <= 25 && woDiff > 0;

  if (aggressiveLong) {
    return {
      label: "Retail is crowded long at a historical extreme while the combined COT view leans offered; this is a contrarian risk context, not proof of a handoff or a reversal.",
      tone: "warning",
    };
  }

  if (aggressiveShort) {
    return {
      label: priceChange > 0
        ? "Retail is crowded short at a historical extreme while the combined COT view leans bid and price is rising; this is a contrarian risk context, not proof of absorption or reversal."
        : "Retail is crowded short at a historical extreme while the combined COT view leans bid; this is a contrarian risk context, not proof of absorption or reversal.",
      tone: "warning",
    };
  }

  if (stance === "bid" && retailNet < 0) {
    return {
      label: "Retail is positioned against the bid; note the divergence as context, but it is not a standalone absorption or distribution signal.",
      tone: "caution",
    };
  }

  if (stance === "offer" && retailNet > 0) {
    return {
      label: "Retail is positioned against the offer; note the divergence as context, but it is not a standalone absorption or accumulation signal.",
      tone: "caution",
    };
  }

  return {
    label: "Retail is not showing a directionally aligned extreme against the combined COT view; keep the position in context, not in isolation.",
    tone: "neutral",
  };
}

function isRetailExtremeAgainstWo(retailNet: number, retailIndex: number, woDiff: number): boolean {
  return (retailNet > 0 && retailIndex >= 75 && woDiff < 0)
    || (retailNet < 0 && retailIndex <= 25 && woDiff > 0);
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
  oiChange: number,
  series: SeriesPoint[],
): { score: number; stance: Stance; flags: string[] } {
  let score = 0;
  const flags: string[] = [];

  score += Math.sign(woDiff) * 2;
  if (woIndex >= 80) score += 2;
  else if (woIndex >= 65) score += 1;
  else if (woIndex <= 20) score -= 2;
  else if (woIndex <= 35) score -= 1;

  const distributionTop = isDistributionSetup(woDiff, nc, comm, retail);
  const retailExtreme = retail.index;

  if (distributionTop) {
    score -= 2;
    flags.push(
      "Commercials are short while non-commercials and retail are long — institutional distribution / top-risk setup",
    );
  }

  const commercialExitSignal = hasCommercialExitContext(comm, woDiff, oiChange, series);
  if (commercialExitSignal) {
    flags.push(
      "Commercials are reducing short exposure as the WO difference rolls over from a recent positioning peak and open interest contracts — possible early unwind; confirm with price",
    );
    score -= 1;
  }

  const corporateLongHedgeExpansion = comm.net > 0 && comm.dNet > 0 && oiChange > 0 && nc.net < 0;
  if (corporateLongHedgeExpansion) {
    flags.push(
      "Corporate hedgers are adding longs with rising open interest while institutions are short — offer pressure is expanding",
    );
    score -= 1;
  }

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
  if (nc.flow.kind === "cover-short" && nc.index <= 30) {
    flags.push(
      "Large specs are covering shorts from an extreme — the rally may be relief-driven; require fresh demand to hold before treating it as a new bullish trend",
    );
  }
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
  if (comm.flow.kind === "cover-short" && oiChange < 0) {
    flags.push("Commercial short covering is underway — early profit-taking rather than fresh bullish conviction");
  }
  if (comm.flow.kind === "accum-long" && oiChange > 0) {
    flags.push("Corporate hedgers are adding longs with rising open interest — inverse offer pressure is strengthening");
  }

  if (nc.flow.kind === "profit-long" && nc.index >= 70) {
    flags.push("Profit taking: large specs cutting longs near an extreme");
  }
  if (nc.flow.kind === "profit-short" && nc.index <= 30) {
    flags.push("Profit taking: large specs covering shorts near an extreme");
  }

  const stretchedLongHandoff =
    nc.net > 0 &&
    nc.index >= 80 &&
    retail.net > 0 &&
    retailExtreme >= 75 &&
    (comm.dNet > 0 || comm.net < 0 || oiChange < 0);
  if (stretchedLongHandoff) {
    flags.push(
      "Long-crowding risk: large specs and retail are stretched long while commercial positioning may be shifting — late-stage exhaustion risk; chart confirmation required.",
    );
    score -= 2;
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
  if (distributionTop && score > 5) score = 5;
  let stance: Stance = "balanced";
  if (score >= 6) stance = "strong-bid";
  else if (score >= 3) stance = "bid";
  else if (score <= -6) stance = "strong-offer";
  else if (score <= -3) stance = "offer";
  return { score, stance, flags };
}

function buildTradingSignal(
  comm: GroupSnapshot,
  noncomm: GroupSnapshot,
  retail: GroupSnapshot,
  woDiff: number,
): InstrumentReport["tradingSignal"] {
  const distribution = isDistributionSetup(woDiff, { ...noncomm }, comm, retail);
  const institutional = noncomm.net > 0 && noncomm.dNet > 0
    ? "BULLISH"
    : noncomm.net < 0 && noncomm.dNet < 0
      ? "BEARISH"
      : "MIXED";
  const speculators = comm.net < 0
    ? "BULLISH"
    : comm.net > 0
      ? "BEARISH"
      : "MIXED";
  return {
    action: "WAIT",
    label: distribution ? "COT context conflicted" : institutional === speculators && institutional !== "MIXED" ? "COT context aligned" : institutional === "MIXED" || speculators === "MIXED" ? "Insufficient confirmation" : "COT context conflicted",
    summary: distribution
      ? "White Oak positioning is historically stretched into a distribution / top-risk state. Treat the bullish difference as late-cycle context, not fresh accumulation, and wait for price and zone confirmation."
      : institutional === speculators && institutional !== "MIXED"
      ? "COT positioning provides a directional storyline, but White Oak methodology still requires price to reach the institutional supply or demand zone and confirm before entry."
      : "COT positioning is conflicted or incomplete. Follow the storyline, then wait for price and an institutional supply or demand zone to confirm before entry.",
    institutional,
    speculators,
  };
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

  const distributionSetup = isDistributionSetup(woDiff, nc, comm, retail)
      ? "Commercial and large-spec books are historically stretched while retail remains net long, a distribution / top-risk context where the market may be selling into speculative demand."
      : "The positioning is not yet a clean distribution setup; the book remains mixed and needs chart confirmation.";

  const hedgeFundCycle =
    comm.net < 0 && nc.net > 0
      ? "The hedge-fund cycle is often: trapped shorts, forced short covering, trend flip, then speculative expansion at the top of the move."
      : "The hedge-fund cycle is still unfolding, and the signal must be checked against the chart before assuming a full trend change.";

  const parts = [
    `Non-commercials are net ${formatSigned(nc.net)} and ${nc.flow.label.toLowerCase()} this week (${formatSigned(nc.dNet)}).`,
    `Commercials are net ${formatSigned(comm.net)} — ${comm.flow.woLabel.toLowerCase()} (${formatSigned(comm.dNet)}).`,
    `Retail (non-reportable) sits net ${formatSigned(retail.net)}, ${retail.flow.label.toLowerCase()}.`,
    `White Oak difference (large-spec net minus commercial net) is ${formatSigned(woDiff)}, index ${woIndex.toFixed(0)} — ${extreme}.`,
    distributionSetup,
    hedgeFundCycle,
  ];
  if (flags[0]) parts.push(flags[0] + ".");
  parts.push(
    "The key distinction: short covering is a passive profit-taking move with falling open interest, while fresh long accumulation is a stronger conviction move with rising open interest. Confirm the read with the chart's demand and supply before acting.",
  );
  return { headline, body: parts.join(" ") };
}

function buildStoryline(
  woDiff: number,
  woDiffChange: number,
  nc: GroupSnapshot,
  comm: GroupSnapshot,
  retail: GroupSnapshot,
  stance: Stance,
): {
  whoInControl: "buyers" | "sellers" | "mixed";
  controlShift: "large weekly positioning shift" | "stable" | "transitioning";
  cycle: "early accumulation" | "mid-expansion" | "distribution" | "exhaustion" | "mixed";
  confirmation: "confirms" | "contradicts" | "mixed";
  summary: string;
} {
  const whoInControl =
    woDiff > 0 ? "buyers" : woDiff < 0 ? "sellers" : "mixed";
  const controlShift =
    Math.abs(woDiffChange) > 20_000 ? "large weekly positioning shift" :
    Math.abs(woDiffChange) > 5_000 ? "transitioning" :
    "stable";

  const cycle =
    isDistributionSetup(woDiff, nc, comm, retail) ? "distribution" :
    comm.net > 0 && nc.net > 0 && woDiff > 0 ? "early accumulation" :
    nc.net > 0 && comm.net < 0 ? "mid-expansion" :
    comm.net > 0 && nc.net < 0 ? "exhaustion" :
    "mixed";

  const confirmation =
    stance === "strong-bid" || stance === "bid"
      ? (woDiff > 0 ? "confirms" : "contradicts")
      : stance === "strong-offer" || stance === "offer"
        ? (woDiff < 0 ? "confirms" : "contradicts")
        : "mixed";

  const summary =
    whoInControl === "buyers"
      ? "The combined COT positioning leans bid: large specs are net long relative to commercial hedging. Price structure still needs separate confirmation."
      : whoInControl === "sellers"
        ? "The combined COT positioning leans offered: large specs are net short relative to commercial hedging. Price structure still needs separate confirmation."
        : "COT positioning is mixed; this report does not infer price control without market-chart evidence.";

  return { whoInControl, controlShift, cycle, confirmation, summary };
}

function buildZoneRead(pair: string, woDiff: number): {
  label: string;
  quality: "Not assessed";
  proximity: string;
  alignment: "Not assessed";
  reminder: string;
} {
  const pairDifference = USD_BASE_PAIRS.has(pair) ? -woDiff : woDiff;
  const label = pairDifference > 0 ? "COT demand context" : pairDifference < 0 ? "COT supply context" : "Balanced COT context";
  const quality = "Not assessed";
  const proximity = "Price proximity cannot be measured from COT positioning; map and confirm a chart zone.";
  return {
    label,
    quality,
    proximity,
    alignment: "Not assessed",
    reminder: "This is positioning context, not a price zone. Use a trader-confirmed chart zone and price reaction before entry.",
  };
}

export function buildTriggerLogic(
  woIndex: number,
  comm: Pick<GroupSnapshot, "net">,
  noncomm: Pick<GroupSnapshot, "net">,
  stance: Stance,
): TriggerLogic {
  const strongBidMatched = woIndex > 75 && comm.net < 0 && noncomm.net > 0;
  if (stance === "strong-bid") {
    return {
      label: "STRONG BID",
      rule: "WO index > 75 AND commercial net is negative (corporate hedging a rise) AND non-commercial net is positive (institutional long).",
      matched: strongBidMatched,
    };
  }
  if (stance === "strong-offer") {
    return {
      label: "STRONG OFFER",
      rule: "WO index < 25 AND commercial net is positive (corporate hedging a decline) AND non-commercial net is negative (institutional short).",
      matched: woIndex < 25 && comm.net > 0 && noncomm.net < 0,
    };
  }
  return {
    label: stance === "balanced" ? "WAIT" : stance === "bid" ? "BID" : "OFFER",
    rule: "This directional COT stance is a bias, not a complete trigger; a mapped price zone and price confirmation are still required before entry.",
    matched: false,
  };
}

function buildThesisStatus(
  stance: Stance,
): ThesisStatus {
  return stance === "balanced" ? "EXPIRED" : "FORMING";
}

function buildTrendlineRead(): {
  status: "Not assessed";
  direction: "Not assessed";
  alignment: "Not assessed";
  summary: string;
} {
  return {
    status: "Not assessed",
    direction: "Not assessed",
    alignment: "Not assessed",
    summary: "A COT positioning index is not a price trendline. Assess market structure separately before treating the thesis as confirmed.",
  };
}

function buildSherlockSteps(
  pair: string,
  woDiff: number,
  stance: Stance,
): Array<{ label: string; state: "check" | "watch" | "cross"; detail: string }> {
  const monthly: { label: string; state: "check" | "watch" | "cross"; detail: string } = {
    label: "Monthly (Macro Structure)",
    state: "watch",
    detail: "Monthly price structure is not included in this COT report; confirm the macro chart independently.",
  };

  const pairDifference = USD_BASE_PAIRS.has(pair) ? -woDiff : woDiff;
  const pairStance = stanceInPairQuote(pair, stance);
  const pairDifferenceDirection = Math.sign(pairDifference);
  const pairStanceDirection = pairStance === "bid" || pairStance === "strong-bid"
    ? 1
    : pairStance === "offer" || pairStance === "strong-offer"
      ? -1
      : 0;
  const weeklyState = pairStanceDirection === 0 || pairDifferenceDirection === 0
    ? "watch"
    : pairStanceDirection === pairDifferenceDirection ? "check" : "cross";
  const weekly: { label: string; state: "check" | "watch" | "cross"; detail: string } = {
    label: "Weekly (COT Positioning)",
    state: weeklyState,
    detail: `WO difference is ${formatSigned(woDiff)} in the futures book; its quoted-pair context is ${pairDifferenceDirection > 0 ? "bid" : pairDifferenceDirection < 0 ? "offer" : "neutral"} for ${pair}.`,
  };

  const daily: { label: string; state: "check" | "watch" | "cross"; detail: string } = {
    label: "Daily (Zone Identification)",
    state: "watch",
    detail: "No price zone is derived from COT contracts; map and confirm a daily supply or demand area on the chart.",
  };

  const hourly: { label: string; state: "check" | "watch" | "cross"; detail: string } = {
    label: "4H / 1H (Entry Preparation)",
    state: "watch",
    detail: "Lower-timeframe candles are not analyzed here; wait for a price trigger inside the confirmed zone.",
  };

  return [monthly, weekly, daily, hourly];
}

function buildPressureStatus(pair: string, woDiff: number, stance: Stance): {
  state: "BULLISH PRESSURE" | "BEARISH PRESSURE" | "NEUTRAL" | "TRANSITIONING";
  crossReference: "Aligned" | "Diverging" | "Contradicting" | "Neutral";
  alert: string;
} {
  const pairDifference = USD_BASE_PAIRS.has(pair) ? -woDiff : woDiff;
  const pairStance = stanceInPairQuote(pair, stance);
  const state =
    pairDifference > 0 ? "BULLISH PRESSURE" :
    pairDifference < 0 ? "BEARISH PRESSURE" :
    "NEUTRAL";

  const crossReference: "Aligned" | "Diverging" | "Contradicting" | "Neutral" =
    (pairStance === "bid" || pairStance === "strong-bid") && pairDifference > 0 ? "Aligned" :
    (pairStance === "offer" || pairStance === "strong-offer") && pairDifference < 0 ? "Aligned" :
    (pairStance === "balanced" ? "Neutral" : "Diverging");

  return {
    state,
    crossReference,
    alert: crossReference === "Aligned"
      ? "Pressure is supporting the current positioning thesis; keep the trade plan anchored to the active zone."
      : crossReference === "Diverging"
        ? "Pressure is starting to contradict the thesis; wait for the next confirmation event before stepping in."
        : "Pressure is mixed and the setup is not ready to act upon yet.",
  };
}

function buildConfluenceScore(
  report: { woDiff: number; woIndex: number; noncomm: GroupSnapshot; comm: GroupSnapshot; retail: GroupSnapshot; oiChange: number; },
): { score: number; total: number; label: "HIGH CONFLUENCE" | "MID CONFLUENCE" | "LOW CONFLUENCE"; summary: string; checks: Array<{ label: string; active: boolean }> } {
  const direction = Math.sign(report.woDiff);
  const checks = [
    { label: "WO difference directional", active: direction !== 0 },
    { label: "Large specs aligned", active: direction !== 0 && Math.sign(report.noncomm.net) === direction },
    { label: "Commercial hedge context", active: direction !== 0 && Math.sign(report.comm.net) === -direction },
    { label: "WO positioning extreme", active: report.woIndex >= 75 || report.woIndex <= 25 },
    { label: "Retail crowded against WO", active: isRetailExtremeAgainstWo(report.retail.net, report.retail.index, report.woDiff) },
    { label: "Open interest expanding", active: report.oiChange > 0 },
  ];
  const score = checks.filter((check) => check.active).length;
  const label = score >= 5 ? "HIGH CONFLUENCE" : score >= 3 ? "MID CONFLUENCE" : "LOW CONFLUENCE";
  const summary =
    score >= 5
      ? "Multiple COT factors agree. This is positioning confluence only; wait for a mapped chart zone and price confirmation before entry."
      : score >= 3
        ? "Several COT factors align, but positioning alone does not confirm a chart setup; wait for a mapped zone and price reaction."
        : "COT factor agreement is limited; keep this on watch until positioning and a price-confirmed zone align.";

  return { score, total: checks.length, label, summary, checks };
}

function buildHistoricalSetup(woIndex: number): { label: string; conviction: string; summary: string; } {
  if (woIndex >= 80) {
    return {
      label: "Upper-tail historical positioning",
      conviction: "Extreme positioning context; not a performance estimate",
      summary: "The WO difference is near the upper end of its observed range. This marks a positioning extreme; it does not establish distribution, exhaustion, or a probability of reversal. Check participant flows and price structure independently.",
    };
  }
  if (woIndex <= 20) {
    return {
      label: "Lower-tail historical positioning",
      conviction: "Extreme positioning context; not a performance estimate",
      summary: "The WO difference is near the lower end of its observed range. This marks a positioning extreme; it does not establish capitulation, exhaustion, or a probability of reversal. Check participant flows and price structure independently.",
    };
  }
  return {
    label: "Middle-range historical positioning",
    conviction: "Positioning context only",
    summary: "The current reading sits around the middle of the observed range. This is descriptive context, not a measured setup or probability estimate.",
  };
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
  const retailDiverging = isRetailExtremeAgainstWo(retail.net, retail.index, woDiff);

  const series: SeriesPoint[] = prints.map((p) => ({
    d: p.date,
    n: p.noncomm.net,
    c: p.comm.net,
    r: p.retail.net,
    w: p.woDiff,
    o: p.oi,
  }));

  const { score, stance, flags } = scoreReading(
    woDiff,
    woIndex,
    nc,
    comm,
    retail,
    retailDiverging,
    latest.oiChange,
    series,
  );
  const tradingSignal = buildTradingSignal(comm, nc, retail, woDiff);
  const { headline, body } = narrative(def, nc, comm, retail, woDiff, woIndex, stance, flags);
  const storyline = buildStoryline(woDiff, woDiffChange, nc, comm, retail, stance);
  const zone = buildZoneRead(def.pair, woDiff);
  const trendline = buildTrendlineRead();
  const sherlock = buildSherlockSteps(def.pair, woDiff, stance);
  const pressure = buildPressureStatus(def.pair, woDiff, stance);
  const confluence = buildConfluenceScore({
    woDiff,
    woIndex,
    noncomm: nc,
    comm,
    retail,
    oiChange: latest.oiChange,
  });
  const historical = buildHistoricalSetup(woIndex);
  const triggerLogic = buildTriggerLogic(woIndex, comm, nc, stance);
  const thesisStatus = buildThesisStatus(stance);
  const weeklyBias =
    stance === "strong-bid" || stance === "bid"
      ? `${def.symbol} — BULLISH COT BIAS THIS WEEK\nPositioning thesis: the COT book leans bid. Wait for price to react at a trader-mapped demand zone and define invalidation from market structure before entry.`
      : stance === "strong-offer" || stance === "offer"
        ? `${def.symbol} — BEARISH COT BIAS THIS WEEK\nPositioning thesis: the COT book leans offered. Wait for price to react at a trader-mapped supply zone and define invalidation from market structure before entry.`
        : `${def.symbol} — RANGE / WAIT-AND-SEE BIAS THIS WEEK\nInstitutional thesis: the current read is neutral and the positional signal is not yet strong enough to force a trade. Wait for a fresh supply/demand break or perfect COT confirmation.`;

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
    thesisStatus,
    triggerLogic,
    tradingSignal,
    score,
    headline,
    body,
    flags,
    series,
    storyline,
    zone,
    trendline,
    sherlock,
    pressure,
    weeklyBias,
    confluence,
    historical,
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
