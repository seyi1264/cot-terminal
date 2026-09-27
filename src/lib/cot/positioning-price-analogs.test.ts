import assert from "node:assert/strict";
import test from "node:test";
import { analyzePositioningPriceAnalogs } from "./positioning-price-analogs.ts";
import type { MarketCandle } from "./price.functions.ts";
import type { SeriesPoint } from "./types.ts";

function fixtures(): { series: SeriesPoint[]; prices: MarketCandle[] } {
  const nets = [
    -100, -70, -30, 10, 50, 90, 120, 100, 80, 60, 40, 20,
    -20, -40, -60, -80, -100, -80, -60, -40, -20, 0, 20, 40,
    60, 40, 20, 0, -20, -40, -60, -80, -100, -80, -60, -40,
  ];
  const series = Array.from({ length: 36 }, (_, index) => ({
    d: new Date(Date.UTC(2020, 0, 7 + index * 7)).toISOString().slice(0, 10),
    n: nets[index]!,
    c: 0,
    r: 0,
    w: 0,
    o: 1,
  }));
  const prices = Array.from({ length: 46 }, (_, index) => {
    const close = 100 + index;
    return {
      date: new Date(Date.UTC(2020, 0, 6 + index * 7)).toISOString(),
      open: close - 1,
      high: close + 1,
      low: close - 2,
      close,
    };
  });
  return { series, prices };
}

test("matches similar institutional short tails to post-report price returns", () => {
  const { series, prices } = fixtures();
  const read = analyzePositioningPriceAnalogs(series, prices, -80, 10, true);
  assert.equal(read.status, "ready");
  assert.equal(read.side, "short");
  assert.ok(read.matches.length > 0);
  assert.ok(read.sampleSize >= read.matches.length);
  assert.ok(read.priceUpRate! > 0);
  assert.ok(read.medianFourWeekReturn! > 0);
  assert.ok(read.middleRange!.low <= read.middleRange!.high);
  assert.match(read.scenario!, /Tentative upside-leaning scenario/);
  assert.match(read.scenario!, /only 2 separated historical cases/);
  assert.match(read.summary, /not a validated forecast/i);
});

test("does not invent an analog when positioning is not at an extreme", () => {
  const { series, prices } = fixtures();
  const read = analyzePositioningPriceAnalogs(series, prices, 10, 48, false);
  assert.equal(read.status, "not-extreme");
  assert.equal(read.matches.length, 0);
  assert.equal(read.sampleSize, 0);
});

test("includes the 40th-percentile short and 60th-percentile long boundaries", () => {
  const { series, prices } = fixtures();
  const shortRead = analyzePositioningPriceAnalogs(series, prices, -80, 40, false);
  const longRead = analyzePositioningPriceAnalogs(series, prices, 80, 60, false);

  assert.notEqual(shortRead.status, "not-extreme");
  assert.notEqual(longRead.status, "not-extreme");
});

test("retains more than five non-overlapping historical matches", () => {
  const series = Array.from({ length: 160 }, (_, index) => ({
    d: new Date(Date.UTC(2020, 0, 7 + index * 7)).toISOString().slice(0, 10),
    n: index === 0 ? 100 : index % 13 === 1 ? -100 : 0,
    c: 0,
    r: 0,
    w: 0,
    o: 1,
  }));
  const prices = Array.from({ length: 180 }, (_, index) => {
    const close = 100 + index;
    return {
      date: new Date(Date.UTC(2020, 0, 6 + index * 7)).toISOString(),
      open: close - 1,
      high: close + 1,
      low: close - 2,
      close,
    };
  });
  const read = analyzePositioningPriceAnalogs(series, prices, -100, 0, false);

  assert.equal(read.status, "ready");
  assert.ok(read.matches.length > 5);
  assert.equal(read.matches.length, read.sampleSize);
});