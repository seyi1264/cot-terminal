import test from "node:test";
import assert from "node:assert/strict";
import type { InstrumentReport } from "./types";
import {
  DEFAULT_WATCHLIST_SETTINGS,
  getWatchAlerts,
  readWatchlistSession,
  writeWatchlistSession,
} from "./watchlist.ts";

test("readWatchlistSession falls back safely and prefers sessionStorage", () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { sessionStorage: globalThis.sessionStorage },
  });

  try {
  globalThis.sessionStorage.clear();

  assert.deepEqual(readWatchlistSession(), {
    codes: [],
    settings: DEFAULT_WATCHLIST_SETTINGS,
  });

  writeWatchlistSession(["ES", "NQ"], {
    extremeThreshold: 95,
    shiftThreshold: 250_000,
  });

  assert.deepEqual(readWatchlistSession(), {
    codes: ["ES", "NQ"],
    settings: {
      extremeThreshold: 95,
      shiftThreshold: 250_000,
    },
  });

  } finally {
    if (originalStorage) Object.defineProperty(globalThis, "sessionStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("watch alerts prioritize methodology confluence and trigger logic over raw threshold noise", () => {
  const report: InstrumentReport = {
        code: "ES",
        symbol: "ES",
        name: "S&P 500",
        pair: "ES",
        category: "equity",
        exchange: "CME",
        asOf: "2024-01-01",
        oi: 1000,
        oiChange: 200,
        noncomm: { long: 0, short: 0, spread: 0, net: 0, total: 0, pctOiLong: 0, pctOiShort: 0, dLong: 0, dShort: 0, dNet: 0, index: 0, avg13: 0, vs13: 0, minAll: 0, maxAll: 0, flow: { kind: "unchanged", label: "Quiet", woLabel: "Quiet" } },
        comm: { long: 0, short: 0, spread: 0, net: 0, total: 0, pctOiLong: 0, pctOiShort: 0, dLong: 0, dShort: 0, dNet: 0, index: 0, avg13: 0, vs13: 0, minAll: 0, maxAll: 0, flow: { kind: "unchanged", label: "Quiet", woLabel: "Quiet" } },
        retail: { long: 0, short: 0, spread: 0, net: 0, total: 0, pctOiLong: 0, pctOiShort: 0, dLong: 0, dShort: 0, dNet: 0, index: 0, avg13: 0, vs13: 0, minAll: 0, maxAll: 0, flow: { kind: "unchanged", label: "Quiet", woLabel: "Quiet" } },
        woDiff: 42000,
        woDiffChange: 26_000,
        woIndex: 82,
        woAvg13: 14000,
        stance: "bid",
        thesisStatus: "ACTIVE",
        triggerLogic: { label: "STRONG BID", rule: "Trigger matched", matched: true },
        tradingSignal: { action: "WAIT", label: "COT context aligned", summary: "", institutional: "BULLISH", speculators: "BULLISH" },
        score: 7,
        headline: "Bid bias",
        body: "Signal is building",
        flags: ["Strong bid"],
        series: [],
        storyline: { whoInControl: "buyers", controlShift: "large weekly positioning shift", cycle: "mid-expansion", confirmation: "confirms", summary: "Positioning shift supports the COT read" },
        confluence: { score: 5, total: 6, label: "HIGH CONFLUENCE", summary: "Strong confluence", checks: [] },
      };
  const alerts = getWatchAlerts(
    [report],
    ["ES"],
    DEFAULT_WATCHLIST_SETTINGS,
  );

  assert.equal(alerts.length, 1);
  assert.deepEqual(alerts[0]?.reasons, [
    "COT trigger conditions matched",
    "Methodology confluence is strong",
  ]);

  const lowerThresholdAlerts = getWatchAlerts(
    [report],
    ["ES"],
    { ...DEFAULT_WATCHLIST_SETTINGS, shiftThreshold: 25_000 },
  );
  assert.ok(lowerThresholdAlerts[0]?.reasons.includes("Weekly shift +26,000"));
});
