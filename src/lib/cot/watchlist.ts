import type { InstrumentReport } from "./types";

export type WatchlistSettings = {
  extremeThreshold: number;
  shiftThreshold: number;
  notificationsEnabled: boolean;
};

export type WatchAlert = {
  code: string;
  symbol: string;
  reasons: string[];
};

export const DEFAULT_WATCHLIST_SETTINGS: WatchlistSettings = {
  extremeThreshold: 90,
  shiftThreshold: 100_000,
  notificationsEnabled: false,
};

export function getWatchAlerts(
  reports: InstrumentReport[],
  codes: string[],
  settings: WatchlistSettings,
): WatchAlert[] {
  return reports
    .filter((report) => codes.includes(report.code))
    .map((report) => {
      const extreme = Math.max(report.woIndex, 100 - report.woIndex);
      const reasons = [
        extreme >= settings.extremeThreshold ? `Extreme ${extreme.toFixed(0)}% reading` : null,
        Math.abs(report.woDiffChange) >= settings.shiftThreshold
          ? `Weekly shift ${formatSignedNumber(report.woDiffChange)}`
          : null,
      ].filter((reason): reason is string => Boolean(reason));

      return { code: report.code, symbol: report.symbol, reasons };
    })
    .filter((alert) => alert.reasons.length > 0);
}

export function notificationSupport(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported" as const;
  return Notification.requestPermission();
}

export async function showWatchAlerts(alerts: WatchAlert[]) {
  if (!alerts.length || notificationSupport() !== "granted") return;
  const title = `${alerts.length} COT alert${alerts.length === 1 ? "" : "s"} needs review`;
  const body = alerts
    .slice(0, 3)
    .map((alert) => `${alert.symbol}: ${alert.reasons.join("; ")}`)
    .join("\n");

  try {
    const registration = await navigator.serviceWorker?.ready;
    if (registration) {
      await registration.showNotification(title, {
        body,
        icon: "/__grok/icon-180.png",
        tag: "oak-ledger-watchlist",
      });
      return;
    }
  } catch {
    // Fall through to the browser notification API.
  }

  new Notification(title, { body, tag: "oak-ledger-watchlist" });
}

function formatSignedNumber(value: number) {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toLocaleString("en-US")}`;
}