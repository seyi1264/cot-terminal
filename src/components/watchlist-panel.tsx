import * as Dialog from "@radix-ui/react-dialog";
import { Bell, Check, Star, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_WATCHLIST_SETTINGS,
  type WatchlistSettings,
  getWatchAlerts,
  requestNotificationPermission,
} from "@/lib/cot/watchlist";
import type { InstrumentReport } from "@/lib/cot/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "oak-ledger-watchlist";

export function WatchlistPanel({
  reports,
  open,
  onClose,
  codes,
  onCodesChange,
  settings,
  onSettingsChange,
  notificationPermission,
  onNotificationPermissionChange,
}: {
  reports: InstrumentReport[];
  open: boolean;
  onClose: () => void;
  codes: string[];
  onCodesChange: (codes: string[]) => void;
  settings: WatchlistSettings;
  onSettingsChange: (settings: WatchlistSettings) => void;
  notificationPermission: NotificationPermission | "unsupported";
  onNotificationPermissionChange: (permission: NotificationPermission | "unsupported") => void;
}) {
  const [hydrated, setHydrated] = useState(false);
  const watched = useMemo(
    () => reports.filter((report) => codes.includes(report.code)),
    [codes, reports],
  );

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as {
        codes?: unknown;
        settings?: Partial<WatchlistSettings>;
      } | null;
      if (Array.isArray(saved?.codes)) {
        onCodesChange(saved.codes.filter((code): code is string => typeof code === "string"));
      }
      if (saved?.settings) {
        onSettingsChange({
          extremeThreshold: numberOrDefault(saved.settings.extremeThreshold, DEFAULT_WATCHLIST_SETTINGS.extremeThreshold),
          shiftThreshold: numberOrDefault(saved.settings.shiftThreshold, DEFAULT_WATCHLIST_SETTINGS.shiftThreshold),
          notificationsEnabled: saved.settings.notificationsEnabled === true,
        });
      }
    } catch {
      setHydrated(true);
    }
    setHydrated(true);
  }, [onCodesChange, onSettingsChange]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ codes, settings }));
  }, [codes, hydrated, settings]);

  function toggleCode(code: string) {
    onCodesChange(codes.includes(code) ? codes.filter((item) => item !== code) : [...codes, code]);
  }

  async function enableNotifications() {
    const permission = await requestNotificationPermission();
    onNotificationPermissionChange(permission);
    if (permission === "granted") onSettingsChange({ ...settings, notificationsEnabled: true });
  }

  function updateSettings(patch: Partial<WatchlistSettings>) {
    onSettingsChange({ ...settings, ...patch });
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-bg/70 data-[state=open]:animate-in" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col overflow-y-auto bg-bg-elevated shadow-[var(--shadow-border)] outline-none data-[state=open]:animate-in"
          aria-describedby={undefined}
        >
          <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-bg-elevated/95 px-5 py-4 backdrop-blur-sm">
            <div>
              <Dialog.Title className="font-display text-2xl font-medium tracking-tight text-fg">
                Your watchlist
              </Dialog.Title>
              <p className="mt-1 text-sm text-muted">Track the markets that matter to your thesis.</p>
            </div>
            <Button variant="quiet" size="icon" onClick={onClose} aria-label="Close watchlist">
              <X className="size-5" />
            </Button>
          </header>

          <div className="space-y-7 px-5 py-6">
            <section>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-accent">Markets</p>
                  <h3 className="mt-1 font-display text-xl text-fg">Pin instruments to follow</h3>
                </div>
                <span className="font-mono text-xs text-subtle">{codes.length} pinned</span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {reports.map((report) => {
                  const selected = codes.includes(report.code);
                  return (
                    <button
                      key={report.code}
                      type="button"
                      onClick={() => toggleCode(report.code)}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
                        selected
                          ? "border-accent/60 bg-bg-subtle"
                          : "border-border bg-bg hover:border-accent/40",
                      )}
                    >
                      <span>
                        <span className="block font-mono text-sm font-medium text-fg">{report.symbol}</span>
                        <span className="mt-0.5 block text-xs text-muted">{report.name}</span>
                      </span>
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full border",
                          selected ? "border-accent bg-accent text-accent-fg" : "border-border text-subtle",
                        )}
                      >
                        {selected ? <Check className="size-3.5" /> : <Star className="size-3.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="border-y border-border py-5">
              <div className="flex items-start gap-3">
                <Bell className="mt-0.5 size-4 text-accent" />
                <div>
                  <h3 className="font-display text-lg text-fg">Alert thresholds</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    Watched markets appear below when positioning reaches either condition.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-muted">
                  Extreme WO index
                  <select
                    value={settings.extremeThreshold}
                    onChange={(event) => updateSettings({ extremeThreshold: Number(event.target.value) })}
                    className="mt-1 h-9 w-full rounded-md bg-bg px-2 text-sm text-fg shadow-[var(--shadow-border)]"
                  >
                    {[80, 85, 90, 95].map((value) => <option key={value} value={value}>{value}% or beyond</option>)}
                  </select>
                </label>
                <label className="text-xs text-muted">
                  Weekly shift
                  <select
                    value={settings.shiftThreshold}
                    onChange={(event) => updateSettings({ shiftThreshold: Number(event.target.value) })}
                    className="mt-1 h-9 w-full rounded-md bg-bg px-2 text-sm text-fg shadow-[var(--shadow-border)]"
                  >
                    {[50_000, 100_000, 250_000, 500_000].map((value) => <option key={value} value={value}>{value.toLocaleString()} contracts</option>)}
                  </select>
                </label>
              </div>
              <div className="mt-5 flex items-center justify-between gap-4 rounded-lg bg-bg p-3 shadow-[var(--shadow-border)]">
                <div>
                  <p className="text-sm text-fg">Browser notifications</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {notificationPermission === "granted"
                      ? "Enabled on this browser, phone, or desktop when a fresh snapshot loads."
                      : notificationPermission === "denied"
                        ? "Blocked by the browser. Re-enable Oak & Ledger in site settings."
                        : notificationPermission === "unsupported"
                          ? "This browser does not support notifications."
                          : "Get a device notification when a fresh snapshot crosses a threshold."}
                  </p>
                </div>
                {notificationPermission === "granted" ? (
                  <span className="shrink-0 text-xs text-bid">Enabled</span>
                ) : notificationPermission === "unsupported" || notificationPermission === "denied" ? null : (
                  <Button variant="quiet" size="sm" onClick={enableNotifications}>
                    Enable
                  </Button>
                )}
              </div>
            </section>

            <section>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-accent">Signals</p>
                  <h3 className="mt-1 font-display text-xl text-fg">What needs attention</h3>
                </div>
                <span className="font-mono text-xs text-subtle">{watched.length} markets</span>
              </div>
              {watched.length ? (
                <div className="mt-4 space-y-2">
                  {watched.map((report) => {
                    const reasons = getWatchAlerts([report], [report.code], settings)[0]?.reasons ?? [];
                    return (
                      <div key={report.code} className="flex items-center justify-between gap-4 rounded-lg bg-bg p-3 shadow-[var(--shadow-border)]">
                        <div>
                          <p className="font-mono text-sm font-medium text-fg">{report.symbol}</p>
                          <p className="mt-1 text-xs text-muted">{reasons.length ? reasons.join(" · ") : "No threshold crossed this week"}</p>
                        </div>
                        <span className={cn("shrink-0 text-xs", reasons.length ? "text-accent" : "text-subtle")}>
                          {reasons.length ? "Review" : "Quiet"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 rounded-lg bg-bg p-4 text-sm text-muted shadow-[var(--shadow-border)]">
                  Pin a market above to start receiving positioning alerts.
                </p>
              )}
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function numberOrDefault(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}