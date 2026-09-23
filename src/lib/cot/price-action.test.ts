import assert from "node:assert/strict";
import test from "node:test";
import { analyzePriceAction } from "./price-action.ts";
import type { MarketCandle } from "./price.functions.ts";

function candle(close: number, spread = 0.2): MarketCandle {
  return { date: "2026-01-01", open: close - 0.05, high: close + spread, low: close - spread, close };
}

test("requires enough candles before reading structure", () => {
  const read = analyzePriceAction(Array.from({ length: 5 }, () => candle(100)));
  assert.equal(read.confirmed, false);
  assert.equal(read.trigger, "No confirmation");
});

test("recognizes a bullish body-close breakout with bullish structure", () => {
  const closes = [10, 10.5, 11, 10.4, 10.8, 11.5, 10.9, 11.2, 12, 11.3, 11.8, 12.5, 12.1, 12, 13];
  const candles = closes.map((close, index) => candle(close, index === 13 ? 0.05 : 0.2));
  const read = analyzePriceAction(candles);
  assert.equal(read.trigger, "Bullish breakout");
  assert.equal(read.trendline, "Broken");
});