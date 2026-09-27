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
  sampleSize: number;
  priceUpRate: number | null;
  medianFourWeekReturn: number | null;
  middleRange: { low: number; high: number } | null;
  scenario: string | null;
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

function quantile(values: number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (index - lower);
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
  const isMatchingExtreme = lowerTail ? currentIndex <= 40 : currentIndex >= 60;
  if (!isMatchingExtreme) {
    return {
      status: "not-extreme",
      side,
      matches: [],
      sampleSize: 0,
      priceUpRate: null,
      medianFourWeekReturn: null,
      middleRange: null,
      scenario: null,
      summary: `No past examples are shown because current non-commercial net positioning is at the ${currentIndex.toFixed(0)}th percentile. This comparison only runs for net shorts at or below the 40th percentile, or net longs at or above the 60th.`,
    };
  }

  if (series.length < 18 || prices.length < 6) {
    return {
      status: "insufficient",
      side,
      matches: [],
      sampleSize: 0,
      priceUpRate: null,
      medianFourWeekReturn: null,
      middleRange: null,
      scenario: null,
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
  const episodes: PositioningPriceAnalog[] = [];
  for (const candidate of candidates) {
    const weeksFromSelected = episodes.map((match) =>
      Math.abs((new Date(candidate.date).getTime() - new Date(match.date).getTime()) / (7 * 24 * 60 * 60 * 1000)),
    );
    if (weeksFromSelected.some((weeks) => weeks < 13)) continue;
    episodes.push(candidate);
  }

  if (episodes.length === 0) {
    return {
      status: "insufficient",
      side,
      matches: [],
      sampleSize: 0,
      priceUpRate: null,
      medianFourWeekReturn: null,
      middleRange: null,
      scenario: null,
      summary: "No comparable historical positioning episodes have complete post-report price data.",
    };
  }

  const returns = episodes.map((episode) => episode.fourWeekReturn);
  const medianFourWeekReturn = median(returns);
  const priceUpRate = (returns.filter((value) => value > 0).length / returns.length) * 100;
  const middleRange = { low: quantile(returns, 0.25), high: quantile(returns, 0.75) };
  const matches = episodes.sort((left, right) => left.date.localeCompare(right.date));
  const direction = priceUpRate >= 65 && medianFourWeekReturn > 0
    ? "upside-leaning"
    : priceUpRate <= 35 && medianFourWeekReturn < 0
      ? "downside-leaning"
      : "mixed, with no consistent directional lean";
  const scenario = episodes.length < 5
    ? `Tentative ${direction} scenario: only ${episodes.length} separated historical cases are available. Price rose in ${priceUpRate.toFixed(0)}% of them; the median four-week move was ${medianFourWeekReturn >= 0 ? "+" : ""}${medianFourWeekReturn.toFixed(2)}%. Treat this as limited evidence.`
    : `Historical base case: ${direction}. Price rose in ${priceUpRate.toFixed(0)}% of ${episodes.length} separated cases; the median four-week move was ${medianFourWeekReturn >= 0 ? "+" : ""}${medianFourWeekReturn.toFixed(2)}%. The middle half of outcomes ranged from ${middleRange.low >= 0 ? "+" : ""}${middleRange.low.toFixed(2)}% to ${middleRange.high >= 0 ? "+" : ""}${middleRange.high.toFixed(2)}%.`;
  const sideText = side === "short" ? "net-short" : "net-long";
  const buildText = currentShortBuild && side === "short" ? " Short contracts also increased and net positioning moved further short in the latest report." : "";
  return {
    status: "ready",
    side,
    matches,
    sampleSize: episodes.length,
    priceUpRate,
    medianFourWeekReturn,
    middleRange,
    scenario,
    summary: `Non-commercials are at a historical ${sideText} extreme. ${episodes.length} non-overlapping past reports had the same net-position side and a similar historical percentile. Their median market-price move over the following four weeks was ${medianFourWeekReturn >= 0 ? "+" : ""}${medianFourWeekReturn.toFixed(2)}%.${buildText} This is historical context, not a validated forecast.`,
  };
}