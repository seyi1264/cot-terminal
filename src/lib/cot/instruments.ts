import type { CotCategory, Stance } from "./types";

export type InstrumentDef = {
  code: string;
  symbol: string;
  name: string;
  pair: string;
  category: CotCategory;
  exchange: string;
};

export const INSTRUMENTS: InstrumentDef[] = [
  { code: "099741", symbol: "EUR", name: "Euro FX", pair: "EURUSD", category: "fx", exchange: "CME" },
  { code: "096742", symbol: "GBP", name: "British Pound", pair: "GBPUSD", category: "fx", exchange: "CME" },
  { code: "097741", symbol: "JPY", name: "Japanese Yen", pair: "USDJPY", category: "fx", exchange: "CME" },
  { code: "232741", symbol: "AUD", name: "Australian Dollar", pair: "AUDUSD", category: "fx", exchange: "CME" },
  { code: "090741", symbol: "CAD", name: "Canadian Dollar", pair: "USDCAD", category: "fx", exchange: "CME" },
  { code: "092741", symbol: "CHF", name: "Swiss Franc", pair: "USDCHF", category: "fx", exchange: "CME" },
  { code: "112741", symbol: "NZD", name: "New Zealand Dollar", pair: "NZDUSD", category: "fx", exchange: "CME" },
  { code: "095741", symbol: "MXN", name: "Mexican Peso", pair: "USDMXN", category: "fx", exchange: "CME" },
  { code: "098662", symbol: "DXY", name: "US Dollar Index", pair: "DXY", category: "fx", exchange: "ICE" },
  { code: "088691", symbol: "XAU", name: "Gold", pair: "XAUUSD", category: "metals", exchange: "COMEX" },
  { code: "084691", symbol: "XAG", name: "Silver", pair: "XAGUSD", category: "metals", exchange: "COMEX" },
  { code: "085692", symbol: "HG", name: "Copper", pair: "HG", category: "metals", exchange: "COMEX" },
  { code: "067651", symbol: "CL", name: "WTI Crude", pair: "CL", category: "energy", exchange: "NYMEX" },
  { code: "023651", symbol: "NG", name: "Natural Gas", pair: "NG", category: "energy", exchange: "NYMEX" },
  { code: "13874A", symbol: "ES", name: "E-mini S&P 500", pair: "ES", category: "equity", exchange: "CME" },
  { code: "209742", symbol: "NQ", name: "E-mini Nasdaq", pair: "NQ", category: "equity", exchange: "CME" },
  { code: "043602", symbol: "ZN", name: "10-Year Note", pair: "ZN", category: "rates", exchange: "CBOT" },
  { code: "020601", symbol: "ZB", name: "US Treasury Bond", pair: "ZB", category: "rates", exchange: "CBOT" },
  { code: "133741", symbol: "BTC", name: "Bitcoin", pair: "BTC", category: "crypto", exchange: "CME" },
];

export const INSTRUMENT_BY_CODE = Object.fromEntries(
  INSTRUMENTS.map((row) => [row.code, row]),
) as Record<string, InstrumentDef>;

export const CATEGORY_LABEL: Record<CotCategory | "all", string> = {
  all: "All markets",
  fx: "Currencies",
  metals: "Metals",
  energy: "Energy",
  equity: "Equity index",
  rates: "Rates",
  crypto: "Crypto",
};

/** Yen, franc, loonie, peso futures are quoted as the foreign currency. USDXXX pairs invert the bid language. */
export const USD_BASE_PAIRS = new Set(["USDJPY", "USDCAD", "USDCHF", "USDMXN"]);

export function stanceInPairQuote(pair: string, stance: Stance): Stance {
  if (!USD_BASE_PAIRS.has(pair)) return stance;
  const inverse: Record<Stance, Stance> = {
    "strong-bid": "strong-offer",
    bid: "offer",
    balanced: "balanced",
    offer: "bid",
    "strong-offer": "strong-bid",
  };
  return inverse[stance];
}

export function doesStanceSupportZone(
  pair: string,
  stance: Stance,
  direction: "demand" | "supply",
): boolean {
  const pairStance = stanceInPairQuote(pair, stance);
  return direction === "demand"
    ? pairStance === "bid" || pairStance === "strong-bid"
    : pairStance === "offer" || pairStance === "strong-offer";
}
