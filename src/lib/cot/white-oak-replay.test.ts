import assert from "node:assert/strict";
import test from "node:test";
import { readWhiteOakReplayPriceAction } from "./white-oak-replay.ts";
import type { MarketCandle, MarketTimeframes } from "./price.functions.ts";

function candle(date: string, close: number): MarketCandle {
  return { date, open: close - 1, high: close + 2, low: close - 2, close };
}

function timeframes(): MarketTimeframes {
  return {
    monthly: ["2024-12-01", "2025-01-01", "2025-02-01", "2025-03-01", "2025-04-01", "2025-05-01", "2025-06-01", "2025-07-01", "2025-08-01", "2025-09-01", "2025-10-01", "2025-11-01", "2025-12-01"].map((date, index) => candle(date, 100 + index)),
    weekly: Array.from({ length: 80 }, (_, index) => candle(new Date(Date.UTC(2024, 0, 1 + index * 7)).toISOString(), 100 + index)),
    daily: Array.from({ length: 400 }, (_, index) => candle(new Date(Date.UTC(2024, 0, 1 + index)).toISOString(), 100 + index)),
    fourHour: Array.from({ length: 40 }, (_, index) => candle(new Date(Date.UTC(2025, 0, 4 + index)).toISOString(), 100 + index)),
    oneHour: Array.from({ length: 40 }, (_, index) => candle(new Date(Date.UTC(2025, 0, 4 + index)).toISOString(), 100 + index)),
  };
}

test("uses closed higher-timeframe candles before the Friday COT release", () => {
  const read = readWhiteOakReplayPriceAction(timeframes(), "2025-01-07", "2025-01-14");

  assert.equal(read.releaseDate, "2025-01-10");
  assert.equal(read.monthly.status, "insufficient");
  assert.match(read.monthly.read?.summary ?? "", /not enough candles/i);
  assert.equal(read.weekly.status, "available");
  assert.equal(read.daily.status, "available");
  assert.equal(read.mappedZoneStatus, "not-assessed");
});

test("does not infer post-release confirmation before a following COT snapshot exists", () => {
  const read = readWhiteOakReplayPriceAction(timeframes(), "2025-01-07");

  assert.equal(read.fourHour.status, "awaiting-next-report");
  assert.equal(read.fourHour.read, null);
  assert.equal(read.oneHour.status, "awaiting-next-report");
});

test("marks intraday history outside provider coverage rather than inventing confirmation", () => {
  const read = readWhiteOakReplayPriceAction(timeframes(), "2024-01-02", "2024-01-09");

  assert.equal(read.fourHour.status, "outside-coverage");
  assert.equal(read.oneHour.status, "outside-coverage");
  assert.equal(read.fourHour.read, null);
});