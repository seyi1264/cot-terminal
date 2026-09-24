import { INSTRUMENTS, USD_BASE_PAIRS } from "./instruments.ts";
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
  priceChange: number;
  commercialNet: number;
  woDiff: number;
};

export type OIContextRead = {
  label: string;
  tone: "strong-bid" | "bid" | "cautious" | "offer" | "strong-offer" | "neutral";
  confidence: number;
};

export function interpretOpenInterestContext({
  oiChange,
  priceChange,
  commercialNet,
  woDiff,
}: OIContextInput): OIContextRead {
  const priceUp = priceChange > 0;
  const priceDown = priceChange < 0;

  if (oiChange > 0 && priceUp) {
    const strong = commercialNet < 0 && woDiff > 0;
    return {
      label: strong
        ? "Rising OI + rising bias = genuine trend participation: new money is confirming the move, not just short covering."
        : "Rising OI + rising bias = genuine trend participation: new money is entering with the move.",
      tone: strong ? "strong-bid" : "bid",
      confidence: 82,
    };
  }

  if (oiChange < 0 && priceUp) {
    return {
      label: "Falling OI + rising bias = short covering only: the move is weaker and a fade is more likely than a fresh breakout.",
      tone: "cautious",
      confidence: 68,
    };
  }

  if (oiChange > 0 && priceDown) {
    return {
      label: "Rising OI + falling bias = fresh shorts are entering; follow the downtrend unless the book resets.",
      tone: "strong-offer",
      confidence: 82,
    };
  }

  if (oiChange < 0 && priceDown) {
    return {
      label: "Falling OI + falling bias = long liquidation: the downtrend is tiring and may be nearing exhaustion.",
      tone: "offer",
      confidence: 62,
    };
  }

  return {
    label: "Open interest is not yet decisive; treat the move as a setup until price and participation line up.",
    tone: "neutral",
    confidence: 45,
  };
}

export type RetailDivergenceInput = {
  retailNet: number;
  woDiff: number;
  retailExtreme: number;
  stance: Stance;
};

export type RetailDivergenceRead = {
  label: string;
  tone: "warning" | "caution" | "neutral";
  confidence: number;
};

export function summarizeRetailDivergence({
  retailNet,
  woDiff,
  retailExtreme,
  stance,
}: RetailDivergenceInput): RetailDivergenceRead {
  const aggressiveLong = retailNet > 0 && retailExtreme >= 75;
  const aggressiveShort = retailNet < 0 && retailExtreme >= 75;
  const crowding = Math.abs(retailNet) > 0 && retailExtreme >= 75;

  if (aggressiveLong) {
    return {
      label: "Crowded retail long: the tape is being bought into by the crowd while the institutional book is being sold. Contrarian fade risk is rising.",
      tone: "warning",
      confidence: 78,
    };
  }

  if (aggressiveShort) {
    return {
      label: "Crowded retail short: the crowd is leaning into the offer while institutions may be accumulating against it. Contrarian upside risk is rising.",
      tone: "warning",
      confidence: 78,
    };
  }

  if (crowding && Math.sign(retailNet) !== Math.sign(woDiff || 1)) {
    return {
      label: "Retail is diverging from the institutional reading; treat the move as a potential exhaustion or trap until the book confirms.",
      tone: "caution",
      confidence: 60,
    };
  }

  if (stance === "bid" && retailNet < 0) {
    return {
      label: "Retail is leaning against the bid; this is a potential absorption or distribution signal at the edges.",
      tone: "caution",
      confidence: 52,
    };
  }

  if (stance === "offer" && retailNet > 0) {
    return {
      label: "Retail is leaning against the offer; this is a potential absorption or accumulation signal at the edges.",
      tone: "caution",
      confidence: 52,
    };
  }

  return {
    label: "Retail is not crowded enough to be a decisive contrarian trigger; keep the position in context, not in isolation.",
    tone: "neutral",
    confidence: 40,
  };
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

  const distributionTop =
    comm.net < 0 && nc.net > 0 && retail.net > 0 && woDiff > 0 && comm.index <= 35 && nc.index >= 65;

  if (distributionTop) {
    score -= 2;
    flags.push(
      "Commercials are short while non-commercials and retail are long — institutional distribution / top-risk setup",
    );
  }

  const latestWo = series.at(-1)?.w ?? woDiff;
  const priorPeak = Math.max(...series.slice(-13).map((point) => point.w));
  const commercialExitSignal = comm.net < 0 && comm.dNet > 0 && latestWo < priorPeak && oiChange < 0;
  if (commercialExitSignal) {
    flags.push(
      "Commercials are closing shorts and reducing exposure while price still sits near a recent high — early reversal footprint",
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

function buildTradingSignal(
  comm: GroupSnapshot,
  noncomm: GroupSnapshot,
  woDiff: number,
): InstrumentReport["tradingSignal"] {
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
    label: institutional === speculators && institutional !== "MIXED" ? "COT context aligned" : institutional === "MIXED" || speculators === "MIXED" ? "Insufficient confirmation" : "COT context conflicted",
    summary: institutional === speculators && institutional !== "MIXED"
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

  const distributionSetup =
    comm.net < 0 && nc.net > 0 && retail.net > 0 && woDiff > 0
      ? "Commercials are short while large specs and retail are long, which is a classic distribution / top-risk setup: the market is being sold into speculative demand."
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
  controlShift: "recent breakout" | "stable" | "transitioning";
  cycle: "early accumulation" | "mid-expansion" | "distribution" | "exhaustion" | "mixed";
  confirmation: "confirms" | "contradicts" | "mixed";
  summary: string;
} {
  const whoInControl =
    woDiff > 0 ? "buyers" : woDiff < 0 ? "sellers" : "mixed";
  const controlShift =
    Math.abs(woDiffChange) > 20_000 ? "recent breakout" :
    Math.abs(woDiffChange) > 5_000 ? "transitioning" :
    "stable";

  const cycle =
    comm.net < 0 && nc.net > 0 && retail.net > 0 && woDiff > 0 ? "distribution" :
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
      ? "The chart story is being led by buyers: price is being carried by institutional demand while the commercial book remains structurally short or neutral."
      : whoInControl === "sellers"
        ? "The market is being led by sellers: price is being capped by institutional supply while the commercial book is still leaning into hedged downside."
        : "The market is still in a mixed-control phase; the chart is not yet giving a clean institutional leader.";

  return { whoInControl, controlShift, cycle, confirmation, summary };
}

function buildZoneRead(woDiff: number, woIndex: number, stance: Stance): {
  label: string;
  quality: "Fresh" | "Once-tested" | "Twice-tested" | "Stale";
  proximity: string;
  alignment: "Aligned" | "Diverging" | "Neutral";
  reminder: string;
} {
  const label = woDiff >= 0 ? "Weekly demand zone — institutional bid area" : "Weekly supply zone — institutional offer area";
  const quality = woIndex >= 80 ? "Fresh" : woIndex >= 60 ? "Once-tested" : woIndex >= 40 ? "Twice-tested" : "Stale";
  const proximity =
    Math.abs(woDiff) > 60_000 ? "Price is very close to the active institutional zone." :
    Math.abs(woDiff) > 25_000 ? "Price remains in the zone approach phase." :
    "Price is still outside the immediate zone band.";
  const alignment =
    (stance === "bid" || stance === "strong-bid") && woDiff >= 0 ? "Aligned" :
    (stance === "offer" || stance === "strong-offer") && woDiff < 0 ? "Aligned" :
    (stance === "balanced" ? "Neutral" : "Diverging");

  return {
    label,
    quality,
    proximity,
    alignment,
    reminder: "Treat the zone as valid only while price remains on the correct side of it; once daily closes remove it, the thesis needs a fresh zone before acting.",
  };
}

function buildTriggerLogic(
  woIndex: number,
  comm: GroupSnapshot,
  noncomm: GroupSnapshot,
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
    rule: "Directional stance requires the White Oak difference, participant extremes, and price confirmation to agree before entry.",
    matched: stance !== "balanced",
  };
}

function buildThesisStatus(
  stance: Stance,
  zone: { quality: "Fresh" | "Once-tested" | "Twice-tested" | "Stale"; proximity: string },
  confluenceScore: number,
  oiChange: number,
): ThesisStatus {
  if (zone.quality === "Stale" || stance === "balanced") return "EXPIRED";
  if (zone.proximity.includes("very close")) return "ACTIVE";
  const directionalOi = (stance === "bid" || stance === "strong-bid") ? oiChange > 0 : oiChange < 0;
  if (confluenceScore >= 5 && directionalOi) return "CONFIRMED";
  return "FORMING";
}

function buildTrendlineRead(woDiff: number, woIndex: number, stance: Stance): {
  status: "Bullish trendline intact" | "Broken" | "Neutral";
  direction: "Bullish" | "Bearish" | "Neutral";
  alignment: "Aligned" | "Diverging" | "Neutral";
  summary: string;
} {
  const direction = woDiff >= 0 ? "Bullish" : "Bearish";
  const status = woIndex >= 75 ? "Bullish trendline intact" : woIndex <= 25 ? "Broken" : "Neutral";
  const alignment =
    (stance === "bid" || stance === "strong-bid") && direction === "Bullish" ? "Aligned" :
    (stance === "offer" || stance === "strong-offer") && direction === "Bearish" ? "Aligned" :
    (stance === "balanced" ? "Neutral" : "Diverging");

  return {
    status,
    direction,
    alignment,
    summary: "Institutional trend context should confirm the bias, not replace it; a broken trendline plus a stretched COT reading is the highest-risk reversal signature.",
  };
}

function buildSherlockSteps(
  woDiff: number,
  woIndex: number,
  stance: Stance,
): Array<{ label: string; state: "check" | "watch" | "cross"; detail: string }> {
  const monthly: { label: string; state: "check" | "watch" | "cross"; detail: string } =
    woIndex >= 70
      ? { label: "Monthly (Macro Bias)", state: "check", detail: "Longer-term structure is bullish and still giving the institutional bid the weight of evidence." }
      : woIndex <= 30
        ? { label: "Monthly (Macro Bias)", state: "cross", detail: "Longer-term structure is bearish and the macro bias is under pressure." }
        : { label: "Monthly (Macro Bias)", state: "watch", detail: "Macro structure is still mixed; keep the horizon flexible until the book confirms." };

  const weekly: { label: string; state: "check" | "watch" | "cross"; detail: string } =
    woDiff >= 0
      ? { label: "Weekly (COT Positioning)", state: "check", detail: `Current WO difference is ${formatSigned(woDiff)} and supports the bid bias.` }
      : { label: "Weekly (COT Positioning)", state: "cross", detail: `Current WO difference is ${formatSigned(woDiff)} and supports the offer bias.` };

  const daily: { label: string; state: "check" | "watch" | "cross"; detail: string } =
    stance === "bid" || stance === "strong-bid"
      ? { label: "Daily (Zone Identification)", state: "check", detail: "The active daily zone should be a demand or support band that confirms the bid thesis." }
      : { label: "Daily (Zone Identification)", state: "watch", detail: "The zone should be treated as the trigger area, not the thesis itself." };

  const hourly: { label: string; state: "check" | "watch" | "cross"; detail: string } =
    stance === "bid" || stance === "strong-bid"
      ? { label: "4H / 1H (Entry Preparation)", state: "watch", detail: "Wait for trend alignment and a clear trigger inside the zone before acting." }
      : { label: "4H / 1H (Entry Preparation)", state: "watch", detail: "Wait for the rejection trigger and confirmation that the short thesis is activating." };

  return [monthly, weekly, daily, hourly];
}

function buildPressureStatus(woDiff: number, stance: Stance): {
  state: "BULLISH PRESSURE" | "BEARISH PRESSURE" | "NEUTRAL" | "TRANSITIONING";
  crossReference: "Aligned" | "Diverging" | "Contradicting" | "Neutral";
  alert: string;
} {
  const state =
    woDiff > 0 ? "BULLISH PRESSURE" :
    woDiff < 0 ? "BEARISH PRESSURE" :
    "NEUTRAL";

  const crossReference: "Aligned" | "Diverging" | "Contradicting" | "Neutral" =
    (stance === "bid" || stance === "strong-bid") && woDiff > 0 ? "Aligned" :
    (stance === "offer" || stance === "strong-offer") && woDiff < 0 ? "Aligned" :
    (stance === "balanced" ? "Neutral" : "Diverging");

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
  report: { woDiff: number; woIndex: number; stance: Stance; comm: GroupSnapshot; retail: GroupSnapshot; oiChange: number; },
): { score: number; total: number; label: "HIGH CONFLUENCE" | "MID CONFLUENCE" | "LOW CONFLUENCE"; summary: string; checks: Array<{ label: string; active: boolean }> } {
  const checks = [
    { label: "COT thesis", active: report.woDiff !== 0 },
    { label: "Zone alignment", active: report.woIndex >= 50 },
    { label: "Retail contrarian", active: report.retail.net !== 0 && report.retail.index >= 70 },
    { label: "Trendline aligned", active: report.woIndex >= 60 || report.woIndex <= 40 },
    { label: "OI confirmation", active: report.oiChange !== 0 },
    { label: "Macro correlation", active: report.stance !== "balanced" },
  ];
  const score = checks.filter((check) => check.active).length;
  const label = score >= 5 ? "HIGH CONFLUENCE" : score >= 3 ? "MID CONFLUENCE" : "LOW CONFLUENCE";
  const summary =
    score >= 5
      ? "The setup is stacking enough confirmations to plan a trade with a clear thesis and an explicit invalidation." 
      : score >= 3
        ? "The market has some institutional evidence, but the trade is still waiting for one more confirmation layer."
        : "Confluence is thin; treat this as a watchlist setup and avoid forcing a trade before price and positioning align.";

  return { score, total: checks.length, label, summary, checks };
}

function buildHistoricalSetup(woIndex: number, stance: Stance): { label: string; conviction: string; summary: string; } {
  if (woIndex >= 80) {
    return {
      label: "Historical extreme / crowded institutional read",
      conviction: "High conviction on the current side of the book",
      summary: "The current reading sits in the upper end of the all-history range, which historically tends to be a high-stakes distribution or exhaustion zone unless price retains structural support.",
    };
  }
  if (woIndex <= 20) {
    return {
      label: "Historical extreme / discounted institutional read",
      conviction: "High conviction on the opposite side of the current short thesis",
      summary: "The setup is deeply discounted versus history; the market often needs a fresh structural break or a clean zone reclaim before this becomes a directional trigger.",
    };
  }
  return {
    label: "Historical middle-band positioning",
    conviction: "Contextual conviction only",
    summary: `The current reading sits around the middle of the all-history range. This is acceptable context, but not yet a decisive move into a high-probability setup.`,
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
  const retailDiverging =
    Math.sign(retail.net) !== 0 && Math.sign(retail.net) !== Math.sign(woDiff || nc.net);

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
  const tradingSignal = buildTradingSignal(comm, nc, woDiff);
  const { headline, body } = narrative(def, nc, comm, retail, woDiff, woIndex, stance, flags);
  const storyline = buildStoryline(woDiff, woDiffChange, nc, comm, retail, stance);
  const zone = buildZoneRead(woDiff, woIndex, stance);
  const trendline = buildTrendlineRead(woDiff, woIndex, stance);
  const sherlock = buildSherlockSteps(woDiff, woIndex, stance);
  const pressure = buildPressureStatus(woDiff, stance);
  const confluence = buildConfluenceScore({
    woDiff,
    woIndex,
    stance,
    comm,
    retail,
    oiChange: latest.oiChange,
  });
  const historical = buildHistoricalSetup(woIndex, stance);
  const triggerLogic = buildTriggerLogic(woIndex, comm, nc, stance);
  const thesisStatus = buildThesisStatus(stance, zone, confluence.score, latest.oiChange);
  const weeklyBias =
    stance === "strong-bid" || stance === "bid"
      ? `${def.symbol} — BULLISH BIAS THIS WEEK\nInstitutional thesis: the current book is still leaning bid and the active zone is the structural focus. Look to buy dips into the demand zone and keep invalidation on the opposite side of the weekly structure.`
      : stance === "strong-offer" || stance === "offer"
        ? `${def.symbol} — BEARISH BIAS THIS WEEK\nInstitutional thesis: the current book is still leaning offer and the active zone is the structural supply band. Look to sell rallies into the supply zone and keep invalidation above the weekly structure.`
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
