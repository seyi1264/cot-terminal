import type { InstrumentReport } from "./types";

export const DOLLAR_COMPLEX_CODES = [
  "098662",
  "099741",
  "096742",
  "097741",
  "232741",
  "090741",
  "092741",
  "095741",
  "112741",
];

export function dollarBiasFromCot(report: Pick<InstrumentReport, "pair" | "woDiff">): number {
  const direction = Math.sign(report.woDiff);
  return direction === 0 || report.pair === "DXY" ? direction : -direction;
}

export function countDirectionalReadings(readings: number[]) {
  const positive = readings.filter((reading) => reading > 0).length;
  const negative = readings.filter((reading) => reading < 0).length;
  const bias = positive > negative ? "positive" : negative > positive ? "negative" : "mixed";
  return { positive, negative, bias } as const;
}