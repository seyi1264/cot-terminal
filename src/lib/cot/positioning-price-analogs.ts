import type { MarketCandle } from "./price.functions";
import type { SeriesPoint } from "./types";

export type PositioningPriceAnalog = {
  date: string;
  percentile: number;
  fourWeekReturn: number;
};

export type PositioningPriceAnalogRead = {
  status: "ready" | "not-extreme" | "insufficient";
  side: "short" | "long";
  matches: PositioningPriceAnalog[];
  medianFourWeekReturn: number | null;
  summary: string;
};

function percentileAt(series: SeriesPoint[], index: number): number {
  const values = series.slice(0, index + 1).map((point) => point.n);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  return maximum === minimum ? 50 : ((series[index]!.n - minimum) / (maximum - minimum)) * 100;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function priceIndexAfterReport(prices: MarketCandle[], reportDate: string): number {
  const releaseDate = new Date(`${reportDate}T00:00:00Z`);
  releaseDate.setUTCDate(releaseDate.getUTCDate() + 3);
  const releaseTime = releaseDate.getTime();
  return prices.findIndex((candle) => new Date(candle.date).getTime() >= releaseTime);
}

export function analyzePositioningPriceAnalogs(
  series: SeriesPoint[],
  prices: MarketCandle[],
  currentNet: number,
  currentIndex: number,
  currentShortBuild: boolean,
): PositioningPriceAnalogRead {
  const side = currentNet < 0 ? "short" : "long";
  const lowerTail = side === "short";
  const isMatchingExtreme = lowerTail ? currentIndex <= 30 : currentIndex >= 70;
  if (!isMatchingExtreme) {
    return {
      status: "not-extreme",
      side,
      matches: [],
      medianFourWeekReturn: null,
      summary: `No past examples are shown because current non-commercial net positioning is at the ${currentIndex.toFixed(0)}th percentile. This comparison only runs for net shorts at or below the 30th percentile, or net longs at or above the 70th.`,
    };
  }

  if (series.length < 18 || prices.length < 6) {
    return {
      status: "insufficient",
      side,
      matches: [],
      medianFourWeekReturn: null,
      summary: "There is not enough aligned COT and weekly price history to compare historical positioning episodes.",
    };
  }

  const candidates: PositioningPriceAnalog[] = [];
  for (let index = 12; index < series.length - 4; index += 1) {
    const point = series[index]!;
    const percentile = percentileAt(series, index);
    const sameSide = lowerTail ? point.n < 0 : point.n > 0;
    if (!sameSide || Math.abs(percentile - currentIndex) > 12) continue;

    const priceIndex = priceIndexAfterReport(prices, point.d);
    if (priceIndex < 0 || priceIndex + 4 >= prices.length) continue;
    const start = prices[priceIndex]!.close;
    const finish = prices[priceIndex + 4]!.close;
    if (!(start > 0) || !Number.isFinite(finish)) continue;
    candidates.push({
      date: point.d,
      percentile,
      fourWeekReturn: ((finish / start) - 1) * 100,
    });
  }

  candidates.sort((left, right) =>
    Math.abs(left.percentile - currentIndex) - Math.abs(right.percentile - currentIndex),
  );
  const selected: PositioningPriceAnalog[] = [];
  for (const candidate of candidates) {
    const weeksFromSelected = selected.map((match) =>
      Math.abs((new Date(candidate.date).getTime() - new Date(match.date).getTime()) / (7 * 24 * 60 * 60 * 1000)),
    );
    if (weeksFromSelected.some((weeks) => weeks < 13)) continue;
    selected.push(candidate);
    if (selected.length === 5) break;
  }
  selected.sort((left, right) => left.date.localeCompare(right.date));

  if (selected.length === 0) {
    return {
      status: "insufficient",
      side,
      matches: [],
      medianFourWeekReturn: null,
      summary: "No comparable historical positioning episodes have complete post-report price data.",
    };
  }

  const medianFourWeekReturn = median(selected.map((match) => match.fourWeekReturn));
  const sideText = side === "short" ? "net-short" : "net-long";
  const buildText = currentShortBuild && side === "short" ? " Short contracts also increased and net positioning moved further short in the latest report." : "";
  return {
    status: "ready",
    side,
    matches: selected,
    medianFourWeekReturn,
    summary: `Non-commercials are at a historical ${sideText} extreme. ${selected.length} past reports had the same net-position side and a similar historical percentile. Their median market-price move over the following four weeks was ${medianFourWeekReturn >= 0 ? "+" : ""}${medianFourWeekReturn.toFixed(2)}%.${buildText} This is historical context, not a forecast.`,
  };
}