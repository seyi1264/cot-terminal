import type { PriceActionRead } from "./price-action.ts";
import { analyzePriceAction } from "./price-action.ts";
import type { MarketCandle, MarketTimeframes } from "./price.functions";

export type ReplayFrameRead = {
  status: "available" | "insufficient" | "outside-coverage" | "awaiting-next-report";
  read: PriceActionRead | null;
};

export type WhiteOakReplayPriceRead = {
  releaseDate: string;
  monthly: ReplayFrameRead;
  weekly: ReplayFrameRead;
  daily: ReplayFrameRead;
  fourHour: ReplayFrameRead;
  oneHour: ReplayFrameRead;
  mappedZoneStatus: "not-assessed";
};

export function readWhiteOakReplayPriceAction(
  timeframes: MarketTimeframes,
  reportDate: string,
  nextReportDate?: string,
): WhiteOakReplayPriceRead {
  const releaseDate = addDays(reportDate, 3);
  const releaseWeek = startOfWeek(releaseDate);
  const releaseMonth = `${releaseDate.slice(0, 7)}-01`;
  const reactionStart = addDays(releaseDate, 1);

  const monthlyContext = before(timeframes.monthly, releaseMonth);
  const weeklyContext = before(timeframes.weekly, releaseWeek);
  const dailyContext = before(timeframes.daily, releaseDate);
  const reactionEnd = nextReportDate ?? "";

  return {
    releaseDate,
    monthly: analyzeWindow(timeframes.monthly, monthlyContext),
    weekly: analyzeWindow(timeframes.weekly, weeklyContext),
    daily: analyzeWindow(timeframes.daily, dailyContext),
    fourHour: analyzeReaction(timeframes.fourHour, reactionStart, reactionEnd),
    oneHour: analyzeReaction(timeframes.oneHour, reactionStart, reactionEnd),
    mappedZoneStatus: "not-assessed",
  };
}

function before(candles: MarketCandle[], cutoff: string): MarketCandle[] {
  return sorted(candles).filter((candle) => candle.date.slice(0, 10) < cutoff);
}

function analyzeWindow(source: MarketCandle[], candles: MarketCandle[]): ReplayFrameRead {
  if (!source.length || !candles.length || candles.at(-1)!.date.slice(0, 10) < source[0]!.date.slice(0, 10)) {
    return { status: "outside-coverage", read: null };
  }
  return {
    status: candles.length >= 12 ? "available" : "insufficient",
    read: analyzePriceAction(candles),
  };
}

function analyzeReaction(source: MarketCandle[], start: string, end: string): ReplayFrameRead {
  if (!end) return { status: "awaiting-next-report", read: null };
  const candles = sorted(source).filter((candle) => {
    const date = candle.date.slice(0, 10);
    return date >= start && date < end;
  });
  const firstDate = sorted(source)[0]?.date.slice(0, 10);
  if (!source.length || (firstDate && start < firstDate)) {
    return { status: "outside-coverage", read: null };
  }
  return {
    status: candles.length >= 12 ? "available" : "insufficient",
    read: analyzePriceAction(candles),
  };
}

function sorted(candles: MarketCandle[]): MarketCandle[] {
  return [...candles].sort((left, right) => left.date.localeCompare(right.date));
}

function addDays(date: string, days: number): string {
  const result = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function startOfWeek(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  const daysSinceMonday = (value.getUTCDay() + 6) % 7;
  value.setUTCDate(value.getUTCDate() - daysSinceMonday);
  return value.toISOString().slice(0, 10);
}

