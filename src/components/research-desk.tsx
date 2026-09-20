import * as Dialog from "@radix-ui/react-dialog";
import { Download, Gauge, History, NotebookPen, TrendingUp, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getMarketPrice } from "@/lib/cot/price.functions";
import { getMacroCalendar, type MacroEvent } from "@/lib/cot/macro.functions";
import { formatSigned } from "@/lib/cot/format";
import type { InstrumentReport } from "@/lib/cot/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { clampReplayRange, resolveReplayRange } from "@/lib/cot/replay-window";

type DeskTab = "confluence" | "replay" | "notes" | "calendar";

const PRICE_SYMBOLS: Record<string, string> = {
  EURUSD: "EURUSD=X",
  GBPUSD: "GBPUSD=X",
  USDJPY: "JPY=X",
  AUDUSD: "AUDUSD=X",
  USDCAD: "CAD=X",
  USDCHF: "CHF=X",
  NZDUSD: "NZDUSD=X",
  USDMXN: "MXN=X",
  DXY: "DX-Y.NYB",
  XAUUSD: "GC=F",
  XAGUSD: "SI=F",
  HG: "HG=F",
  CL: "CL=F",
  NG: "NG=F",
  ES: "ES=F",
  NQ: "NQ=F",
  ZN: "ZN=F",
  ZB: "ZB=F",
  BTC: "BTC-USD",
};

export function ResearchDesk({
  reports,
  onSelect,
}: {
  reports: InstrumentReport[];
  onSelect: (code: string) => void;
}) {
  const [tab, setTab] = useState<DeskTab>("confluence");
  const [replayCode, setReplayCode] = useState(reports[0]?.code ?? "");
  const [replayIndex, setReplayIndex] = useState(0);
  const [noteCode, setNoteCode] = useState(reports[0]?.code ?? "");
  const [notes, setNotes] = useState<Record<string, string>>(() => readNotes());
  const replayReport = reports.find((report) => report.code === replayCode) ?? reports[0];
  const noteReport = reports.find((report) => report.code === noteCode) ?? reports[0];

  useEffect(() => {
    if (replayReport) setReplayIndex(Math.max(0, replayReport.series.length - 1));
  }, [replayCode, replayReport]);

  function saveNote(value: string) {
    const next = { ...notes, [noteCode]: value };
    setNotes(next);
    localStorage.setItem("oak-ledger-thesis-notes", JSON.stringify(next));
  }

  function exportBoard() {
    const header = "symbol,name,asOf,stance,woDiff,woIndex,weekChange";
    const rows = reports.map((report) => [report.symbol, report.name, report.asOf, report.stance, report.woDiff, report.woIndex, report.woDiffChange]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `oak-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="border-y border-border py-6" aria-labelledby="research-desk-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-accent">Research desk</p>
          <h2 id="research-desk-title" className="mt-1 font-display text-2xl font-medium tracking-tight text-fg">
            From signal to decision
          </h2>
        </div>
        <Button variant="quiet" size="sm" onClick={exportBoard}>
          <Download className="size-3.5" /> Export CSV
        </Button>
      </div>
      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-border pb-2">
        {([
          ["confluence", "Confluence", Gauge],
          ["replay", "Replay", History],
          ["notes", "Thesis notes", NotebookPen],
          ["calendar", "Macro calendar", TrendingUp],
        ] as const).map(([value, label, Icon]) => (
          <button key={value} type="button" onClick={() => setTab(value)} className={cn("flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm", tab === value ? "bg-bg-subtle text-fg" : "text-muted hover:text-fg")}>
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "confluence" ? <Confluence reports={reports} onSelect={onSelect} /> : null}
      {tab === "replay" && replayReport ? (
        <Replay report={replayReport} reports={reports} index={replayIndex} onCodeChange={setReplayCode} onIndexChange={setReplayIndex} onSelect={onSelect} />
      ) : null}
      {tab === "notes" && noteReport ? (
        <Notes reports={reports} report={noteReport} value={notes[noteCode] ?? ""} onCodeChange={setNoteCode} onChange={saveNote} />
      ) : null}
      {tab === "calendar" ? <MacroCalendar /> : null}
    </section>
  );
}

function Confluence({ reports, onSelect }: { reports: InstrumentReport[]; onSelect: (code: string) => void }) {
  const groups = [
    { title: "Dollar complex", codes: ["098662", "099741", "096742", "097741", "090741", "092741", "095741", "092741"] },
    { title: "Growth and rates", codes: ["13874A", "209742", "043602", "020601"] },
    { title: "Commodity cycle", codes: ["088691", "084691", "085692", "067651", "023651"] },
  ];
  const performance = buildPerformance(reports);
  return (
    <div className="mt-5 space-y-3">
      <div className="grid gap-3 lg:grid-cols-3">
      {groups.map((group) => {
        const rows = group.codes.map((code) => reports.find((report) => report.code === code)).filter(Boolean) as InstrumentReport[];
        const bid = rows.filter((report) => report.woDiff >= 0).length;
        const tone = bid > rows.length / 2 ? "Bid" : bid < rows.length / 2 ? "Offer" : "Mixed";
        return <button key={group.title} type="button" onClick={() => rows[0] && onSelect(rows[0].code)} className="rounded-lg bg-bg-elevated p-4 text-left shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]">
          <div className="flex items-center justify-between"><span className="font-display text-lg text-fg">{group.title}</span><span className={cn("text-xs", tone === "Bid" ? "text-bid" : tone === "Offer" ? "text-offer" : "text-accent")}>{tone}</span></div>
          <div className="mt-4 flex flex-wrap gap-1.5">{rows.map((report) => <span key={report.code} className={cn("rounded-full bg-bg px-2 py-1 font-mono text-[11px]", report.woDiff >= 0 ? "text-bid" : "text-offer")}>{report.symbol} {formatSigned(report.woDiff, 0)}</span>)}</div>
          <p className="mt-4 text-xs text-muted">{bid} of {rows.length} markets carry a positive WO difference.</p>
        </button>;
      })}
      </div>
      <div className="rounded-lg bg-bg-elevated p-4 shadow-[var(--shadow-border)]">
        <div className="flex items-end justify-between gap-3"><div><p className="text-[11px] uppercase tracking-wide text-accent">Signal history</p><h3 className="mt-1 font-display text-lg text-fg">Did extremes follow through?</h3></div><span className="font-mono text-xs text-muted">{performance.samples} samples</span></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3"><Metric label="4-week follow-through" value={performance.samples ? `${performance.hitRate}%` : "—"} /><Metric label="Positive samples" value={performance.samples ? `${performance.hits}` : "—"} /><Metric label="Method" value="WO direction" /></div>
      </div>
    </div>
  );
}

function buildPerformance(reports: InstrumentReport[]) {
  let samples = 0;
  let hits = 0;
  for (const report of reports) {
    for (let index = 0; index < report.series.length - 4; index += 1) {
      const current = report.series[index]!.w;
      const extreme = report.series.slice(0, index + 1).map((point) => point.w);
      const max = Math.max(...extreme);
      const min = Math.min(...extreme);
      const percentile = max === min ? 50 : ((current - min) / (max - min)) * 100;
      if (percentile >= 90 || percentile <= 10) {
        samples += 1;
        const future = report.series[index + 4]!.w - current;
        if ((percentile >= 90 && future >= 0) || (percentile <= 10 && future <= 0)) hits += 1;
      }
    }
  }
  return { samples, hits, hitRate: samples ? Math.round((hits / samples) * 100) : 0 };
}

function Replay({ report, reports, index, onCodeChange, onIndexChange, onSelect }: { report: InstrumentReport; reports: InstrumentReport[]; index: number; onCodeChange: (code: string) => void; onIndexChange: (index: number) => void; onSelect: (code: string) => void }) {
  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [range, setRange] = useState(() => resolveReplayRange(report.series, report.series[0]?.d, report.series.at(-1)?.d));
  const point = report.series[index] ?? report.series.at(-1);
  const latest = report.series.at(-1);
  const progress = report.series.length > 1 ? (index / (report.series.length - 1)) * 100 : 100;
  const [price, setPrice] = useState<{ close: number; date: string } | null>(null);
  const replaySeries = useMemo(
    () => report.series.slice(range.start, range.end + 1),
    [range, report.series],
  );

  useEffect(() => {
    const symbol = PRICE_SYMBOLS[report.pair];
    if (!symbol) {
      setPrice(null);
      return;
    }
    let active = true;
    void getMarketPrice({ data: { symbol } })
      .then((value) => active && setPrice(value))
      .catch(() => active && setPrice(null));
    return () => {
      active = false;
    };
  }, [report.pair]);

  useEffect(() => {
    const defaults = resolveReplayRange(report.series, report.series[0]?.d, report.series.at(-1)?.d);
    setRange(defaults);
    onIndexChange(defaults.end);
  }, [report.code, report.series, onIndexChange]);

  useEffect(() => {
    if (!isPlaying) return;
    if (index >= range.end) {
      setIsPlaying(false);
      return;
    }
    const delay = 700 / playbackSpeed;
    const id = window.setTimeout(() => onIndexChange(Math.min(index + 1, range.end)), delay);
    return () => window.clearTimeout(id);
  }, [index, isPlaying, onIndexChange, playbackSpeed, range.end]);

  function updateRange(startDate: string, endDate: string) {
    const nextRange = resolveReplayRange(report.series, startDate, endDate);
    setRange(nextRange);
    onIndexChange(nextRange.start);
    setIsPlaying(false);
    setIsRangeModalOpen(false);
  }

  function playRange() {
    setIsPlaying(true);
    onIndexChange(range.start);
  }

  const chartPoints = replaySeries.length
    ? replaySeries
        .map((seriesPoint, seriesIndex) => {
          const x = replaySeries.length === 1 ? 10 : (seriesIndex / (replaySeries.length - 1)) * 100;
          const min = Math.min(...replaySeries.map((item) => item.w));
          const max = Math.max(...replaySeries.map((item) => item.w));
          const y = max === min ? 50 : 100 - ((seriesPoint.w - min) / (max - min || 1)) * 90;
          return `${x},${y}`;
        })
        .join(" ")
    : "";
  const currentWindowIndex = Math.max(0, Math.min(index, range.end) - range.start);
  const visibleSeries = replaySeries.slice(0, Math.max(1, currentWindowIndex + 1));
  const activePoint = visibleSeries.at(-1) ?? replaySeries[0];

  return <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
    <div>
      <label className="text-xs text-muted">Instrument<select value={report.code} onChange={(event) => onCodeChange(event.target.value)} className="mt-1 h-9 w-full rounded-md bg-bg-elevated px-2 text-sm text-fg shadow-[var(--shadow-border)]">{reports.map((item) => <option key={item.code} value={item.code}>{item.symbol} · {item.name}</option>)}</select></label>
      <div className="mt-4 flex items-center justify-between gap-2">
        <p className="text-xs text-muted">Replay window</p>
        <Button variant="quiet" size="sm" onClick={() => setIsRangeModalOpen(true)}>Select dates</Button>
      </div>
      <div className="mt-2 rounded-lg bg-bg-elevated p-3 text-xs text-muted shadow-[var(--shadow-border)]">
        <div className="flex items-center justify-between gap-2"><span>{report.series[range.start]?.d ?? report.series[0]?.d}</span><span className="font-mono text-accent">→</span><span>{report.series[range.end]?.d ?? report.series.at(-1)?.d}</span></div>
      </div>
      <label className="mt-4 block text-xs text-muted">Historical week <input type="range" min={range.start} max={range.end} value={index} onChange={(event) => { setIsPlaying(false); onIndexChange(Number(event.target.value)); }} className="mt-3 w-full accent-[var(--color-accent)]" style={{ "--range-progress": `${progress}%` } as React.CSSProperties} /><span className="mt-2 flex justify-between font-mono text-[11px] text-subtle"><span>{report.series[range.start]?.d}</span><span>{point?.d}</span><span>{report.series[range.end]?.d}</span></span></label>
      <div className="mt-3 rounded-lg bg-bg p-2 shadow-[var(--shadow-border)]">
        <div className="mb-2 flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-subtle">
          <span>Scrubber</span>
          <span>{report.series[index]?.d ?? point?.d}</span>
        </div>
        <div className="relative flex h-3.5 items-center">
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border" />
          {replaySeries.map((seriesPoint, seriesIndex) => {
            const isActive = index >= range.start + seriesIndex && index <= range.end;
            return <button key={`${seriesPoint.d}-${seriesIndex}`} type="button" onClick={() => { setIsPlaying(false); onIndexChange(range.start + seriesIndex); }} className="relative z-10 flex-1" aria-label={`Jump to ${seriesPoint.d}`}>
              <span className={cn("mx-auto block h-2.5 w-2.5 rounded-full border transition-colors", isActive ? "bg-accent border-accent" : "bg-bg border-border")} />
            </button>;
          })}
          <span className="absolute top-1/2 z-20 h-3.5 w-3.5 -translate-y-1/2 rounded-full border border-accent bg-accent" style={{ left: `${Math.max(0, Math.min(100, (Math.max(0, index - range.start) / Math.max(1, range.end - range.start)) * 100))}%` }} />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button variant="quiet" size="sm" onClick={() => { if (isPlaying) { setIsPlaying(false); } else { playRange(); } }}>{isPlaying ? "Pause" : "Play replay"}</Button>
        <Button variant="quiet" size="sm" onClick={() => { setIsPlaying(false); onIndexChange(range.start); }}>Reset</Button>
        <label className="flex items-center gap-2 text-xs text-muted">
          Speed
          <select value={playbackSpeed} onChange={(event) => setPlaybackSpeed(Number(event.target.value))} className="h-8 rounded-md border border-border bg-bg px-2 text-xs text-fg">
            {[0.5, 1, 2, 4].map((speed) => <option key={speed} value={speed}>{speed}x</option>)}
          </select>
        </label>
        <Button variant="quiet" size="sm" onClick={() => onSelect(report.code)}>Open full detail</Button>
      </div>
      <Dialog.Root open={isRangeModalOpen} onOpenChange={setIsRangeModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-bg/70 data-[state=open]:animate-in" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-bg-elevated p-5 shadow-[var(--shadow-border)] outline-none">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="font-display text-xl text-fg">Replay date range</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted">Choose the date window to replay through the historical COT series.</Dialog.Description>
              </div>
              <Button variant="quiet" size="icon" onClick={() => setIsRangeModalOpen(false)} aria-label="Close replay window picker">
                <X className="size-4" />
              </Button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-xs text-muted">Start date<select value={report.series[range.start]?.d ?? report.series[0]?.d} onChange={(event) => {
                  const nextStart = event.target.value;
                  const nextRange = clampReplayRange(report.series.length, report.series.findIndex((point) => point.d === nextStart), range.end);
                  setRange({ ...nextRange, startDate: report.series[nextRange.start]?.d, endDate: report.series[nextRange.end]?.d });
                }} className="mt-1 h-9 w-full rounded-md bg-bg px-2 text-sm text-fg shadow-[var(--shadow-border)]">{report.series.map((point) => <option key={point.d} value={point.d}>{point.d}</option>)}</select></label>
              <label className="text-xs text-muted">End date<select value={report.series[range.end]?.d ?? report.series.at(-1)?.d} onChange={(event) => {
                  const nextEnd = event.target.value;
                  const nextRange = clampReplayRange(report.series.length, range.start, report.series.findIndex((point) => point.d === nextEnd));
                  setRange({ ...nextRange, startDate: report.series[nextRange.start]?.d, endDate: report.series[nextRange.end]?.d });
                }} className="mt-1 h-9 w-full rounded-md bg-bg px-2 text-sm text-fg shadow-[var(--shadow-border)]">{report.series.map((point) => <option key={point.d} value={point.d}>{point.d}</option>)}</select></label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="quiet" size="sm" onClick={() => setIsRangeModalOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={() => updateRange(report.series[range.start]?.d ?? report.series[0]?.d, report.series[range.end]?.d ?? report.series.at(-1)?.d)}>Apply range</Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Metric label="WO difference" value={point ? formatSigned(point.w) : "—"} />
      <Metric label="Net specs" value={point ? formatSigned(point.n) : "—"} />
      <Metric label="Commercials" value={point ? formatSigned(point.c) : "—"} />
      <Metric label="Open interest" value={point ? point.o.toLocaleString() : "—"} />
      <div className="col-span-full mt-2 grid gap-2 sm:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-lg bg-bg p-3 shadow-[var(--shadow-border)]">
          <div className="flex items-center justify-between gap-2"><p className="text-[10px] uppercase tracking-wide text-subtle">Replay chart</p><span className="font-mono text-[11px] text-accent">{range.startDate ?? report.series[0]?.d} → {range.endDate ?? report.series.at(-1)?.d}</span></div>
          <svg viewBox="0 0 100 100" className="mt-3 h-32 w-full" aria-label={`${report.symbol} replay chart`}>
            <defs>
              <linearGradient id={`replay-${report.code}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.5" />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            <polyline points={chartPoints} fill="none" stroke="var(--color-accent)" strokeWidth="2" />
            <polyline points={visibleSeries.length > 1 ? visibleSeries.map((seriesPoint, seriesIndex) => {
                const x = replaySeries.length === 1 ? 10 : (seriesIndex / Math.max(1, replaySeries.length - 1)) * 100;
                const min = Math.min(...replaySeries.map((item) => item.w));
                const max = Math.max(...replaySeries.map((item) => item.w));
                const y = max === min ? 50 : 100 - ((seriesPoint.w - min) / (max - min || 1)) * 90;
                return `${x},${y}`;
              }).join(" ") : ""} fill="none" stroke="var(--color-bid)" strokeWidth="2" opacity="0.9" />
            {activePoint ? (() => {
              const min = Math.min(...replaySeries.map((item) => item.w));
              const max = Math.max(...replaySeries.map((item) => item.w));
              const x = replaySeries.length === 1 ? 50 : ((Math.max(0, visibleSeries.length - 1)) / Math.max(1, replaySeries.length - 1)) * 100;
              const y = max === min ? 50 : 100 - ((activePoint.w - min) / (max - min || 1)) * 90;
              return <circle cx={x} cy={y} r="4" fill="var(--color-accent)" />;
            })() : null}
          </svg>
          <div className="mt-2 flex items-center justify-between text-[11px] text-subtle"><span>{replaySeries[0]?.d}</span><span>{activePoint?.d}</span><span>{replaySeries.at(-1)?.d}</span></div>
        </div>
        <div className="rounded-lg bg-bg p-3 text-xs leading-relaxed text-muted shadow-[var(--shadow-border)]">Replay is based on the historical COT print, before later weeks were known. Use it to inspect how positioning evolved, not as a price backtest.</div>
      </div>
      <div className="col-span-full mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-bg p-3 shadow-[var(--shadow-border)]"><p className="text-[10px] uppercase tracking-wide text-subtle">Latest price context</p><p className="mt-2 font-mono text-sm text-fg">{price ? price.close.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "Unavailable"}</p><p className="mt-1 text-xs text-muted">{price ? `Yahoo Finance daily close · ${price.date}` : "Price source did not return a quote."}</p></div>
      </div>
    </div>
  </div>;
}

function Notes({ reports, report, value, onCodeChange, onChange }: { reports: InstrumentReport[]; report: InstrumentReport; value: string; onCodeChange: (code: string) => void; onChange: (value: string) => void }) {
  return <div className="mt-5 grid gap-4 lg:grid-cols-[16rem_1fr]">
    <select value={report.code} onChange={(event) => onCodeChange(event.target.value)} className="h-9 rounded-md bg-bg-elevated px-2 text-sm text-fg shadow-[var(--shadow-border)]">{reports.map((item) => <option key={item.code} value={item.code}>{item.symbol} · {item.name}</option>)}</select>
    <div><textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder="Thesis, catalyst, invalidation level..." className="min-h-32 w-full resize-y rounded-lg bg-bg-elevated p-3 text-sm leading-relaxed text-fg outline-none shadow-[var(--shadow-border)] placeholder:text-subtle focus:shadow-[var(--shadow-border-hover)]" /><p className="mt-2 text-xs text-subtle">Saved locally on this device.</p></div>
  </div>;
}

function MacroCalendar() {
  const [events, setEvents] = useState<MacroEvent[]>([]);
  useEffect(() => { void getMacroCalendar({}).then(setEvents).catch(() => setEvents([])); }, []);
  return <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{events.length ? events.filter((event) => event.impact === "High" || event.impact === "Medium").slice(0, 18).map((event) => <div key={`${event.date}-${event.title}`} className="rounded-lg bg-bg-elevated p-3 shadow-[var(--shadow-border)]"><div className="flex items-center justify-between gap-2"><p className="font-mono text-xs text-accent">{new Date(event.date).toLocaleDateString()}</p><span className={cn("text-[10px] uppercase", event.impact === "High" ? "text-offer" : "text-accent")}>{event.impact}</span></div><p className="mt-2 text-sm font-medium text-fg">{event.title}</p><p className="mt-1 text-xs text-muted">{event.country}{event.forecast ? ` · Forecast ${event.forecast}` : ""}</p></div>) : <p className="rounded-lg bg-bg-elevated p-4 text-sm text-muted">Live macro calendar unavailable right now.</p>}</div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-bg p-3 shadow-[var(--shadow-border)]"><p className="text-[10px] uppercase tracking-wide text-subtle">{label}</p><p className="mt-2 font-mono text-sm tabular text-fg">{value}</p></div>;
}

function readNotes(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const value = JSON.parse(localStorage.getItem("oak-ledger-thesis-notes") ?? "{}") as unknown;
    return value && typeof value === "object" ? value as Record<string, string> : {};
  } catch {
    return {};
  }
}