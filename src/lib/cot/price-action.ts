import type { MarketCandle, MarketTimeframes, MarketTimeframe } from "./price.functions";

export type PriceActionRead = {
  structure: "Bullish" | "Bearish" | "Range";
  trendline: "Bullish intact" | "Bearish intact" | "Broken" | "Unconfirmed";
  trigger: "Bullish rejection" | "Bearish rejection" | "Bullish breakout" | "Bearish breakout" | "No confirmation";
  momentumShift: "BOS" | "CHOCH" | "None";
  displacement: boolean;
  confirmed: boolean;
  summary: string;
};

export type MultiTimeframeRead = {
  aligned: boolean;
  direction: "Bullish" | "Bearish" | "Mixed";
  momentumShift: "BOS" | "CHOCH" | "None";
  timeframes: Record<MarketTimeframe, PriceActionRead>;
  summary: string;
};

type Pivot = { index: number; price: number };

function findPivots(candles: MarketCandle[], kind: "high" | "low"): Pivot[] {
  const pivots: Pivot[] = [];
  for (let index = 2; index < candles.length - 2; index += 1) {
    const price = candles[index]![kind];
    const neighbors = candles.slice(index - 2, index + 3);
    const isPivot = neighbors.every((candle, offset) => offset === 2 || (kind === "high" ? price >= candle.high : price <= candle.low));
    if (isPivot) pivots.push({ index, price });
  }
  return pivots;
}

function lineAt(first: Pivot, second: Pivot, index: number): number {
  return first.price + ((second.price - first.price) * (index - first.index)) / (second.index - first.index);
}

function hasThirdTouch(candles: MarketCandle[], first: Pivot, second: Pivot, kind: "high" | "low"): boolean {
  const tolerance = Math.max(candles.at(-1)!.close * 0.002, 0.0001);
  return candles.slice(second.index + 1, -1).some((candle, offset) => {
    const index = second.index + 1 + offset;
    return Math.abs(candle[kind] - lineAt(first, second, index)) <= tolerance;
  });
}

export function analyzePriceAction(candles: MarketCandle[]): PriceActionRead {
  if (candles.length < 12) return { structure: "Range", trendline: "Unconfirmed", trigger: "No confirmation", momentumShift: "None", displacement: false, confirmed: false, summary: "Not enough candles to confirm market structure." };
  const lows = findPivots(candles, "low").slice(-4);
  const highs = findPivots(candles, "high").slice(-4);
  const latest = candles.at(-1)!;
  const previous = candles.at(-2)!;
  const recentLow = lows.at(-1);
  const priorLow = lows.at(-2);
  const recentHigh = highs.at(-1);
  const priorHigh = highs.at(-2);
  const bullishStructure = Boolean(recentLow && priorLow && recentLow.price > priorLow.price && recentHigh && priorHigh && recentHigh.price > priorHigh.price);
  const bearishStructure = Boolean(recentLow && priorLow && recentLow.price < priorLow.price && recentHigh && priorHigh && recentHigh.price < priorHigh.price);
  const structure = bullishStructure ? "Bullish" : bearishStructure ? "Bearish" : "Range";
  const bullishLine = Boolean(priorLow && recentLow && hasThirdTouch(candles, priorLow, recentLow, "low"));
  const bearishLine = Boolean(priorHigh && recentHigh && hasThirdTouch(candles, priorHigh, recentHigh, "high"));
  const bullishBreak = Boolean(recentHigh && previous.close <= recentHigh.price && latest.close > recentHigh.price);
  const bearishBreak = Boolean(recentLow && previous.close >= recentLow.price && latest.close < recentLow.price);
  const bullishRejection = Boolean(recentLow && latest.low <= recentLow.price && latest.close > latest.open && latest.close > (latest.high + latest.low) / 2);
  const bearishRejection = Boolean(recentHigh && latest.high >= recentHigh.price && latest.close < latest.open && latest.close < (latest.high + latest.low) / 2);
  const trigger = bullishBreak ? "Bullish breakout" : bearishBreak ? "Bearish breakout" : bullishRejection ? "Bullish rejection" : bearishRejection ? "Bearish rejection" : "No confirmation";
  const averageRange = candles.slice(-7, -1).reduce((sum, candle) => sum + (candle.high - candle.low), 0) / 6;
  const currentRange = latest.high - latest.low;
  const displacement = currentRange > averageRange * 1.5 && Math.abs(latest.close - latest.open) / Math.max(currentRange, Number.EPSILON) >= 0.6;
  const momentumShift = trigger === "Bullish breakout" || trigger === "Bearish breakout"
    ? (structure === "Range" ? "CHOCH" : "BOS")
    : "None";
  const confirmed = trigger !== "No confirmation" && ((trigger.startsWith("Bullish") && (bullishLine || bullishStructure)) || (trigger.startsWith("Bearish") && (bearishLine || bearishStructure)));
  const trendline = bullishLine && !bearishBreak ? "Bullish intact" : bearishLine && !bullishBreak ? "Bearish intact" : bullishBreak || bearishBreak ? "Broken" : "Unconfirmed";
  return {
    structure,
    trendline,
    trigger,
    momentumShift,
    displacement,
    confirmed,
    summary: confirmed
      ? `${trigger} confirmed against ${structure.toLowerCase()} structure; ${momentumShift} ${displacement ? "with displacement" : "without displacement"}. The trendline uses wick pivots, two anchors, and a third-touch validation.`
      : "Price has not produced a validated structure and candle trigger yet. Wait for a rejection or body-close breakout at the zone.",
  };
}

export function analyzeMultiTimeframe(timeframes: MarketTimeframes): MultiTimeframeRead {
  const reads = Object.fromEntries(
    (Object.keys(timeframes) as MarketTimeframe[]).map((timeframe) => [timeframe, analyzePriceAction(timeframes[timeframe])]),
  ) as Record<MarketTimeframe, PriceActionRead>;
  const ordered: MarketTimeframe[] = ["monthly", "weekly", "daily", "fourHour", "oneHour"];
  const directions = ordered.map((timeframe) => reads[timeframe].structure).filter((structure) => structure !== "Range");
  const bullish = directions.filter((direction) => direction === "Bullish").length;
  const bearish = directions.filter((direction) => direction === "Bearish").length;
  const direction = bullish >= 3 && bullish > bearish ? "Bullish" : bearish >= 3 && bearish > bullish ? "Bearish" : "Mixed";
  const lower = [reads.daily, reads.fourHour, reads.oneHour];
  const aligned = direction !== "Mixed"
    && lower.every((read) => read.structure === direction || read.trigger.startsWith(direction))
    && lower.some((read) => read.confirmed && read.momentumShift !== "None");
  const triggerRead = [...lower].reverse().find((read) => read.confirmed && read.momentumShift !== "None");
  return {
    aligned,
    direction,
    momentumShift: triggerRead?.momentumShift ?? "None",
    timeframes: reads,
    summary: aligned
      ? `${direction} alignment across the higher and execution timeframes with ${triggerRead?.momentumShift} on the entry sequence.`
      : "The monthly, weekly, daily, 4-hour, and 1-hour readings are not aligned enough for a confirmed momentum signal.",
  };
}