export type CotCategory = "fx" | "metals" | "energy" | "equity" | "rates" | "crypto";

export type Stance = "strong-bid" | "bid" | "balanced" | "offer" | "strong-offer";

export type ThesisStatus = "FORMING" | "ACTIVE" | "CONFIRMED" | "EXPIRED";

export type TriggerLogic = {
  label: string;
  rule: string;
  matched: boolean;
};

export type FlowKind =
  | "accum-long"
  | "accum-short"
  | "profit-long"
  | "profit-short"
  | "cover-short"
  | "fade-long"
  | "two-way"
  | "liquidation"
  | "unchanged";

export type TraderGroup = "noncomm" | "comm" | "retail";

export type CotRawRow = {
  cftc_contract_market_code: string;
  report_date_as_yyyy_mm_dd: string;
  open_interest_all: number;
  noncomm_positions_long_all: number;
  noncomm_positions_short_all: number;
  noncomm_postions_spread_all: number;
  comm_positions_long_all: number;
  comm_positions_short_all: number;
  nonrept_positions_long_all: number;
  nonrept_positions_short_all: number;
  change_in_open_interest_all: number;
  change_in_noncomm_long_all: number;
  change_in_noncomm_short_all: number;
  change_in_comm_long_all: number;
  change_in_comm_short_all: number;
  change_in_nonrept_long_all: number;
  change_in_nonrept_short_all: number;
};

export type WeeklyPrint = {
  date: string;
  oi: number;
  oiChange: number;
  noncomm: GroupPrint;
  comm: GroupPrint;
  retail: GroupPrint;
  woDiff: number;
};

export type GroupPrint = {
  long: number;
  short: number;
  spread: number;
  net: number;
  dLong: number;
  dShort: number;
  dNet: number;
};

export type FlowReading = {
  kind: FlowKind;
  label: string;
  woLabel: string;
};

export type GroupSnapshot = {
  long: number;
  short: number;
  spread: number;
  net: number;
  total: number;
  pctOiLong: number;
  pctOiShort: number;
  dLong: number;
  dShort: number;
  dNet: number;
  index: number;
  avg13: number;
  vs13: number;
  minAll: number;
  maxAll: number;
  flow: FlowReading;
};

export type SeriesPoint = {
  d: string;
  n: number;
  c: number;
  r: number;
  w: number;
  o: number;
};

export type MethodologyStoryline = {
  whoInControl: "buyers" | "sellers" | "mixed";
  controlShift: "recent breakout" | "stable" | "transitioning";
  cycle: "early accumulation" | "mid-expansion" | "distribution" | "exhaustion" | "mixed";
  confirmation: "confirms" | "contradicts" | "mixed";
  summary: string;
};

export type ZoneRead = {
  label: string;
  quality: "Fresh" | "Once-tested" | "Twice-tested" | "Stale";
  proximity: string;
  alignment: "Aligned" | "Diverging" | "Neutral";
  reminder: string;
};

export type TrendlineRead = {
  status: "Bullish trendline intact" | "Broken" | "Neutral";
  direction: "Bullish" | "Bearish" | "Neutral";
  alignment: "Aligned" | "Diverging" | "Neutral";
  summary: string;
};

export type SherlockStep = {
  label: string;
  state: "check" | "watch" | "cross";
  detail: string;
};

export type PressureStatus = {
  state: "BULLISH PRESSURE" | "BEARISH PRESSURE" | "NEUTRAL" | "TRANSITIONING";
  crossReference: "Aligned" | "Diverging" | "Contradicting" | "Neutral";
  alert: string;
};

export type ConfluenceScore = {
  score: number;
  total: number;
  label: "HIGH CONFLUENCE" | "MID CONFLUENCE" | "LOW CONFLUENCE";
  summary: string;
  checks: Array<{ label: string; active: boolean }>;
};

export type HistoricalSetupRead = {
  label: string;
  conviction: string;
  summary: string;
};

export type InstrumentReport = {
  code: string;
  symbol: string;
  name: string;
  pair: string;
  category: CotCategory;
  exchange: string;
  asOf: string;
  oi: number;
  oiChange: number;
  noncomm: GroupSnapshot;
  comm: GroupSnapshot;
  retail: GroupSnapshot;
  woDiff: number;
  woDiffChange: number;
  woIndex: number;
  woAvg13: number;
  stance: Stance;
  thesisStatus: ThesisStatus;
  triggerLogic: TriggerLogic;
  score: number;
  headline: string;
  body: string;
  flags: string[];
  series: SeriesPoint[];
  storyline?: MethodologyStoryline;
  zone?: ZoneRead;
  trendline?: TrendlineRead;
  sherlock?: SherlockStep[];
  pressure?: PressureStatus;
  weeklyBias?: string;
  confluence?: ConfluenceScore;
  historical?: HistoricalSetupRead;
};

export type CotBoard = {
  asOf: string;
  fetchedAt: string;
  source: "live" | "unavailable";
  lagNote: string;
  instruments: InstrumentReport[];
};
