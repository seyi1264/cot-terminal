import type { InstrumentReport } from "./types";

export type WatchlistSettings = {
  extremeThreshold: number;
  shiftThreshold: number;
};

export type WatchAlert = {
  code: string;
  symbol: string;
  reasons: string[];
};

export const DEFAULT_WATCHLIST_SETTINGS: WatchlistSettings = {
  extremeThreshold: 90,
  shiftThreshold: 100_000,
};

const STORAGE_KEY = "oak-ledger-watchlist";

export function readWatchlistSession(): { codes: string[]; settings: WatchlistSettings } {
  if (typeof window === "undefined") {
    return { codes: [], settings: DEFAULT_WATCHLIST_SETTINGS };
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { codes: [], settings: DEFAULT_WATCHLIST_SETTINGS };
    }

    const parsed = JSON.parse(raw) as {
      codes?: unknown;
      settings?: Partial<WatchlistSettings>;
    } | null;

    return {
      codes: Array.isArray(parsed?.codes)
        ? parsed.codes.filter((code): code is string => typeof code === "string")
        : [],
      settings: {
        extremeThreshold:
          typeof parsed?.settings?.extremeThreshold === "number"
            ? parsed.settings.extremeThreshold
            : DEFAULT_WATCHLIST_SETTINGS.extremeThreshold,
        shiftThreshold:
          typeof parsed?.settings?.shiftThreshold === "number"
            ? parsed.settings.shiftThreshold
            : DEFAULT_WATCHLIST_SETTINGS.shiftThreshold,
      },
    };
  } catch {
    return { codes: [], settings: DEFAULT_WATCHLIST_SETTINGS };
  }
}

export function writeWatchlistSession(codes: string[], settings: WatchlistSettings) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        codes,
        settings,
      }),
    );
  } catch {
    // Ignore storage exceptions; the UI should continue with in-memory state.
  }
}

export function getWatchAlerts(
  reports: InstrumentReport[],
  codes: string[],
  settings: WatchlistSettings,
): WatchAlert[] {
  return reports
    .filter((report) => codes.includes(report.code))
    .map((report) => {
      const reasons: string[] = [];
      const extreme = Math.max(report.woIndex, 100 - report.woIndex);
      const weeklyShift = Math.abs(report.woDiffChange);

      if (report.triggerLogic?.matched) {
        reasons.push("Trigger logic matched");
      }

      const confluenceScore = report.confluence?.score ?? 0;
      const confluenceTotal = report.confluence?.total ?? 0;
      if (confluenceTotal > 0 && confluenceScore >= Math.max(4, Math.ceil(confluenceTotal * 0.7))) {
        reasons.push("Methodology confluence is strong");
      }

      const probablyActiveShift = weeklyShift >= Math.min(10_000, settings.shiftThreshold * 0.25);
      if (probablyActiveShift) {
        reasons.push(`Weekly shift ${formatSignedNumber(report.woDiffChange)}`);
      }

      if (extreme >= settings.extremeThreshold) {
        reasons.push(`Extreme ${extreme.toFixed(0)}% reading`);
      }

      return { code: report.code, symbol: report.symbol, reasons };
    })
    .filter((alert) => alert.reasons.length > 0);
}

function formatSignedNumber(value: number) {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toLocaleString("en-US")}`;
}