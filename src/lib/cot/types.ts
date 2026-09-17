export type CotCategory = "fx" | "metals" | "energy" | "equity" | "rates" | "crypto";

export type Stance = "strong-bid" | "bid" | "balanced" | "offer" | "strong-offer";

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
  score: number;
  headline: string;
  body: string;
  flags: string[];
  series: SeriesPoint[];
};

export type CotBoard = {
  asOf: string;
  fetchedAt: string;
  source: "live" | "fallback";
  lagNote: string;
  instruments: InstrumentReport[];
};
