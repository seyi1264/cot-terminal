import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeInstrument,
  buildTriggerLogic,
  getCotPeriodPriceChange,
  hasCommercialExitContext,
  interpretOpenInterestContext,
  summarizeRetailDivergence,
} from "./white-oak.ts";
import { INSTRUMENTS } from "./instruments.ts";

test("rising oi with rising price is treated as genuine trend participation", () => {
  const read = interpretOpenInterestContext({
    oiChange: 18_000,
    cotPeriodPriceChange: 2.4,
    commercialNet: -20_000,
    woDiff: 24_000,
  });

  assert.match(read.label, /reporting interval.*supports trend participation/i);
  assert.match(read.label, /cannot prove which side initiated/i);
  assert.equal(read.tone, "strong-bid");
});

test("open interest without a market price change is not treated as price confirmation", () => {
  const read = interpretOpenInterestContext({
    oiChange: 18_000,
    commercialNet: -20_000,
    woDiff: 24_000,
  });

  assert.match(read.label, /price confirmation is unavailable/i);
  assert.equal(read.tone, "neutral");
});

test("open-interest price comparison uses matching COT report dates", () => {
  const change = getCotPeriodPriceChange(
    [
      { date: "2025-01-07T00:00:00.000Z", close: 100 },
      { date: "2025-01-14T00:00:00.000Z", close: 104 },
    ],
    "2025-01-07",
    "2025-01-14",
  );
  assert.equal(change, 4);
  assert.equal(getCotPeriodPriceChange([], "2025-01-07", "2025-01-14"), null);
});

test("only explicit extreme COT rules are matched before separate price confirmation", () => {
  const groups = { commercial: { net: -20_000 }, noncommercial: { net: 25_000 } };
  const strong = buildTriggerLogic(82, groups.commercial, groups.noncommercial, "strong-bid");
  const moderate = buildTriggerLogic(60, groups.commercial, groups.noncommercial, "bid");

  assert.equal(strong.matched, true);
  assert.equal(moderate.matched, false);
  assert.match(moderate.rule, /not a complete trigger/i);
});

test("commercial unwind context requires shrinking shorts, WO rollover, and contracting OI", () => {
  const series = [{ w: 100 }, { w: 90 }, { w: 80 }];
  assert.equal(hasCommercialExitContext({ net: -10, dNet: 3 }, 80, -1, series), true);
  assert.equal(hasCommercialExitContext({ net: 10, dNet: 3 }, 80, -1, series), false);
  assert.equal(hasCommercialExitContext({ net: -10, dNet: -3 }, 80, -1, series), false);
  assert.equal(hasCommercialExitContext({ net: -10, dNet: 3 }, 80, 1, series), false);
  assert.equal(hasCommercialExitContext({ net: -10, dNet: 3 }, 100, -1, [{ w: 80 }, { w: 90 }, { w: 100 }]), false);
});

test("falling oi with rising price is treated as weak short covering not fresh breakout", () => {
  const read = interpretOpenInterestContext({
    oiChange: -7_000,
    cotPeriodPriceChange: 1.8,
    commercialNet: -18_000,
    woDiff: 12_000,
  });

  assert.match(read.label, /short covering|weaker move|caution/i);
  assert.equal(read.tone, "cautious");
});

test("retail crowding at extremes is translated into a contrarian direction signal", () => {
  const read = summarizeRetailDivergence({
    retailNet: 18_000,
    retailIndex: 85,
    woDiff: -24_000,
    stance: "offer",
  });

  assert.match(read.label, /crowded long|distribution|contrarian/i);
  assert.equal(read.tone, "warning");
});

test("retail short crowding with rising price stays a cautious contrarian warning", () => {
  const read = summarizeRetailDivergence({
    retailNet: -18_000,
    retailIndex: 15,
    woDiff: 24_000,
    stance: "bid",
    priceChange: 1.6,
  });

  assert.match(read.label, /crowded short.*price is rising.*not proof of absorption/i);
  assert.equal(read.tone, "warning");
});

test("retail net sign cannot turn the opposite historical tail into crowding", () => {
  const read = summarizeRetailDivergence({
    retailNet: 18_000,
    retailIndex: 15,
    woDiff: -24_000,
    stance: "offer",
  });

  assert.doesNotMatch(read.label, /crowded retail long/i);
  assert.notEqual(read.tone, "warning");
});

test("extreme institutional short covering is flagged as a relief rally until demand holds", () => {
  const def = INSTRUMENTS.find((item) => item.code === "099741")!;
  const rows = Array.from({ length: 9 }, (_, index) => {
    const date = new Date(2025, 0, 1 + index).toISOString().slice(0, 10);
    return {
      cftc_contract_market_code: def.code,
      report_date_as_yyyy_mm_dd: date,
      open_interest_all: 500_000,
      noncomm_positions_long_all: index === 8 ? 120_000 : 100_000,
      noncomm_positions_short_all: index === 8 ? 300_000 : 200_000 + index * 14_000,
      noncomm_postions_spread_all: 0,
      comm_positions_long_all: 220_000,
      comm_positions_short_all: 180_000,
      nonrept_positions_long_all: 80_000,
      nonrept_positions_short_all: 60_000,
      change_in_open_interest_all: index === 8 ? -8_000 : 2_000,
      change_in_noncomm_long_all: index === 8 ? 20_000 : 500,
      change_in_noncomm_short_all: index === 8 ? -20_000 : -1_000,
      change_in_comm_long_all: index === 8 ? 1_000 : 400,
      change_in_comm_short_all: index === 8 ? -2_000 : -300,
      change_in_nonrept_long_all: 400,
      change_in_nonrept_short_all: 300,
    };
  });

  const report = analyzeInstrument(def, rows);
  assert.ok(report, "report should exist");
  assert.ok(
    report!.flags.some((flag) => /covering shorts.*extreme|relief-driven|fresh demand/i.test(flag)),
    `expected relief-rally warning, got: ${report!.flags.join(" | ")}`,
  );
});

test("stretched long positioning flags the institutional profit-taking handoff to retail", () => {
  const def = INSTRUMENTS.find((item) => item.code === "097741")!;
  const rows = Array.from({ length: 9 }, (_, index) => {
    const date = new Date(2025, 0, 1 + index).toISOString().slice(0, 10);
    return {
      cftc_contract_market_code: def.code,
      report_date_as_yyyy_mm_dd: date,
      open_interest_all: 520_000,
      noncomm_positions_long_all: 320_000 + index * 4_000,
      noncomm_positions_short_all: 120_000 + index * 2_000,
      noncomm_postions_spread_all: 0,
      comm_positions_long_all: 210_000,
      comm_positions_short_all: 180_000,
      nonrept_positions_long_all: 150_000 + index * 2_500,
      nonrept_positions_short_all: 50_000,
      change_in_open_interest_all: index === 8 ? -8_000 : 4_000,
      change_in_noncomm_long_all: index === 8 ? -20_000 : 6_000,
      change_in_noncomm_short_all: index === 8 ? 10_000 : -1_000,
      change_in_comm_long_all: index === 8 ? 3_000 : -1_000,
      change_in_comm_short_all: index === 8 ? -8_000 : 800,
      change_in_nonrept_long_all: index === 8 ? 3_500 : 1_400,
      change_in_nonrept_short_all: index === 8 ? -1_200 : 300,
    };
  });

  const report = analyzeInstrument(def, rows);
  assert.ok(report, "report should exist");
  assert.ok(
    report!.flags.some((flag) => /institutional.*(long.*(exit|profit)|handoff)|retail.*long|crowded.*long/i.test(flag)),
    `expected a stretched-long / retail handoff warning, got: ${report!.flags.join(" | ")}`,
  );
  assert.equal(report!.zone?.quality, "Not assessed");
  assert.equal(report!.zone?.alignment, "Not assessed");
  assert.equal(report!.zone?.label, "COT supply context");
  assert.match(report!.zone?.proximity ?? "", /cannot be measured from COT/i);
  assert.equal(report!.trendline?.status, "Not assessed");
  assert.equal(report!.trendline?.direction, "Not assessed");
  assert.equal(report!.pressure?.state, "BEARISH PRESSURE");
  assert.match(report!.sherlock?.find(({ label }) => label.startsWith("Weekly"))?.detail ?? "", /quoted-pair context is offer for USDJPY/i);
  assert.equal(report!.historical?.label, "Upper-tail historical positioning");
  assert.match(report!.historical?.conviction ?? "", /not a performance estimate/i);
  assert.notEqual(report!.thesisStatus, "ACTIVE");
  assert.notEqual(report!.thesisStatus, "CONFIRMED");
  assert.match(report!.storyline?.controlShift ?? "", /positioning|stable|transitioning/i);
  assert.ok(report!.sherlock?.filter(({ label }) => !label.includes("COT Positioning")).every(({ state }) => state === "watch"));
  assert.ok(
    report!.confluence?.checks.every(({ label }) => !/zone|trendline|macro|price confirmation/i.test(label)),
    "COT-only analysis must not claim chart or macro factors were observed",
  );
});
