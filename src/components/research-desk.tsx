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
  const [priceHistory, setPriceHistory] = useState<Array<{ date: string; close: number }>>([]);
  const point = report.series[index] ?? report.series.at(-1);
  const latest = report.series.at(-1);
  const [price, setPrice] = useState<{ close: number; date: string } | null>(null);
  const replaySeries = useMemo(
    () => report.series.slice(range.start, range.end + 1),
    [range, report.series],
  );

  useEffect(() => {
    const symbol = PRICE_SYMBOLS[report.pair];
    if (!symbol) {
      setPrice(null);
      setPriceHistory([]);
      return;
    }
    let active = true;
    void getMarketPrice({ data: { symbol } })
      .then((value) => active && setPrice(value))
      .catch(() => active && setPrice(null));
    void import("@/lib/cot/price.functions").then(({ getMarketHistory }) =>
      getMarketHistory({ data: { symbol } })
        .then((history) => active && setPriceHistory(history))
        .catch(() => active && setPriceHistory([])),
    );
    return () => {
      active = false;
    };
  }, [report.pair]);

  const absoluteOldestDate = report.series[0]?.d ?? "—";
  const absoluteLatestDate = report.series.at(-1)?.d ?? "—";
  const replayStartDate = replaySeries[0]?.d ?? absoluteOldestDate;
  const replayEndDate = replaySeries.at(-1)?.d ?? absoluteLatestDate;
  const priceWindow = useMemo(() => {
    if (!priceHistory.length) return [];
    const start = replayStartDate;
    const end = replayEndDate;
    return priceHistory.filter((item) => item.date >= start && item.date <= end);
  }, [priceHistory, replayStartDate, replayEndDate]);
  const priceSeries = useMemo(() => {
    if (!replaySeries.length || !priceWindow.length) return [] as Array<{ date: string; x: number; y: number; close: number }>;
    const min = Math.min(...priceWindow.map((item) => item.close));
    const max = Math.max(...priceWindow.map((item) => item.close));

    return replaySeries
      .map((seriesPoint, seriesIndex) => {
        const matchingPrice = priceWindow.reduce<{ date: string; close: number } | null>((closest, item) => {
          if (!closest) return item;
          return Math.abs(new Date(item.date).getTime() - new Date(seriesPoint.d).getTime()) < Math.abs(new Date(closest.date).getTime() - new Date(seriesPoint.d).getTime()) ? item : closest;
        }, null);
        if (!matchingPrice) return null;
        const close = matchingPrice.close;
        const x = replaySeries.length === 1 ? 50 : (seriesIndex / Math.max(1, replaySeries.length - 1)) * 100;
        const y = max === min ? 94 : 114 - ((close - min) / (max - min || 1)) * 42;
        return { date: seriesPoint.d, x, y, close };
      })
      .filter((point): point is { date: string; x: number; y: number; close: number } => point !== null);
  }, [priceWindow, replaySeries]);
  const priceLinePoints = priceSeries.map((point) => `${point.x},${point.y}`).join(" ");
  const playheadX = replaySeries.length === 1 ? 50 : (Math.max(0, Math.min(index, range.end) - range.start) / Math.max(1, range.end - range.start)) * 100;

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
          const y = max === min ? 30 : 52 - ((seriesPoint.w - min) / (max - min || 1)) * 42;
          return `${x},${y}`;
        })
        .join(" ")
    : "";
  const currentWindowIndex = Math.max(0, Math.min(index, range.end) - range.start);
  const visibleSeries = replaySeries.slice(0, Math.max(1, currentWindowIndex + 1));
  const activePoint = visibleSeries.at(-1) ?? replaySeries[0];
  const activePricePoint = [...priceSeries].reverse().find((pricePoint) => pricePoint.date === activePoint?.d) ?? priceSeries.at(-1) ?? null;

  return <div className="mt-5 space-y-5">
    <div>
      <label className="text-xs text-muted">Instrument<select value={report.code} onChange={(event) => onCodeChange(event.target.value)} className="mt-1 h-9 w-full rounded-md bg-bg-elevated px-2 text-sm text-fg shadow-[var(--shadow-border)]">{reports.map((item) => <option key={item.code} value={item.code}>{item.symbol} · {item.name}</option>)}</select></label>
      <div className="mt-4 flex items-center justify-between gap-2">
        <p className="text-xs text-muted">Replay window</p>
        <Button variant="quiet" size="sm" onClick={() => setIsRangeModalOpen(true)}>Select dates</Button>
      </div>
      <div className="mt-2 rounded-lg bg-bg-elevated p-3 text-xs text-muted shadow-[var(--shadow-border)]">
        <div className="flex items-center justify-between gap-2"><span>{report.series[range.start]?.d ?? report.series[0]?.d}</span><span className="font-mono text-accent">→</span><span>{report.series[range.end]?.d ?? report.series.at(-1)?.d}</span></div>
        <div className="mt-2 rounded-md border border-accent/40 bg-accent/5 px-2 py-1.5 text-[11px] text-accent">
          Oldest CFTC date in this series: <span className="font-mono font-medium">{absoluteOldestDate}</span>
        </div>
      </div>
      <div className="mt-3 max-w-3xl rounded-lg bg-bg p-2 shadow-[var(--shadow-border)]">
        <div className="mb-2 flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-subtle">
          <span>Replay position</span>
          <span>{report.series[index]?.d ?? point?.d}</span>
        </div>
        <input type="range" min={range.start} max={range.end} value={index} onChange={(event) => { setIsPlaying(false); onIndexChange(Number(event.target.value)); }} className="block h-2 w-full accent-[var(--color-accent)]" aria-label="Replay position" />
        <div className="mt-2 flex justify-between font-mono text-[10px] text-subtle"><span>{replayStartDate}</span><span>{replayEndDate}</span></div>
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
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[min(88vh,34rem)] w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-bg-elevated p-4 shadow-[var(--shadow-border)] outline-none sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="font-display text-lg text-fg">Replay date range</Dialog.Title>
                <Dialog.Description className="mt-1 text-xs leading-relaxed text-muted">Choose the historical COT window to replay.</Dialog.Description>
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
            <div className="mt-4 rounded-md border border-border bg-bg px-3 py-2 text-xs text-muted">
              <div className="flex items-center justify-between gap-2">
                <span>Oldest available CFTC date</span>
                <span className="font-mono text-accent">{absoluteOldestDate}</span>
              </div>
              <div className="mt-1 text-[11px] text-subtle">The replay window cannot extend earlier than the first recorded CFTC print for this market.</div>
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
      <div className="col-span-full mt-2 grid gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(16rem,0.7fr)]">
        <div className="rounded-lg bg-bg p-4 shadow-[var(--shadow-border)]">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] uppercase tracking-wide text-subtle">Replay chart</p><p className="mt-1 text-xs text-muted">COT positioning and synchronized weekly price</p></div><span className="font-mono text-[11px] text-accent">{range.startDate ?? report.series[0]?.d} → {range.endDate ?? report.series.at(-1)?.d}</span></div>
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" /> COT positioning</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-bid" /> Price overlay</span><span className="flex items-center gap-1.5"><span className="h-3 w-px border-l border-dashed border-accent" /> Playhead</span></div>
          <svg viewBox="0 0 100 130" className="mt-2 h-56 w-full" preserveAspectRatio="none" aria-label={`${report.symbol} replay chart with synchronized price overlay`}>
            <defs>
              <linearGradient id={`replay-${report.code}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.5" />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            <rect x="0" y="4" width="100" height="52" rx="2" fill="var(--color-bg-elevated)" opacity="0.55" />
            <rect x="0" y="68" width="100" height="52" rx="2" fill="var(--color-bg-elevated)" opacity="0.55" />
            <line x1="0" x2="100" y1="62" y2="62" stroke="var(--color-border)" strokeWidth="0.5" />
            <line x1={playheadX} x2={playheadX} y1="4" y2="120" stroke="var(--color-accent)" strokeWidth="1.2" strokeDasharray="2 3" opacity="0.9" />
            <text x="2" y="11" fill="var(--color-subtle)" fontSize="3" letterSpacing="0.4">COT POSITIONING</text>
            <text x="2" y="75" fill="var(--color-subtle)" fontSize="3" letterSpacing="0.4">WEEKLY PRICE</text>
            <polyline points={chartPoints} fill="none" stroke="var(--color-accent)" strokeWidth="2" />
            {priceLinePoints ? <polyline points={priceLinePoints} fill="none" stroke="var(--color-bid)" strokeWidth="1.5" opacity="0.9" /> : null}
            <polyline points={visibleSeries.length > 1 ? visibleSeries.map((seriesPoint, seriesIndex) => {
                const x = replaySeries.length === 1 ? 10 : (seriesIndex / Math.max(1, replaySeries.length - 1)) * 100;
                const min = Math.min(...replaySeries.map((item) => item.w));
                const max = Math.max(...replaySeries.map((item) => item.w));
                const y = max === min ? 30 : 52 - ((seriesPoint.w - min) / (max - min || 1)) * 42;
                return `${x},${y}`;
              }).join(" ") : ""} fill="none" stroke="var(--color-bid)" strokeWidth="2" opacity="0.9" />
            {activePricePoint ? <circle cx={activePricePoint.x} cy={activePricePoint.y} r="2.2" fill="var(--color-bid)" stroke="var(--color-bg)" strokeWidth="0.5" /> : null}
            {activePoint ? (() => {
              const min = Math.min(...replaySeries.map((item) => item.w));
              const max = Math.max(...replaySeries.map((item) => item.w));
              const x = replaySeries.length === 1 ? 50 : (Math.max(0, Math.min(visibleSeries.length - 1, visibleSeries.length - 1)) / Math.max(1, replaySeries.length - 1)) * 100;
              const y = max === min ? 30 : 52 - ((activePoint.w - min) / (max - min || 1)) * 42;
              return <circle cx={x} cy={y} r="4" fill="var(--color-accent)" stroke="var(--color-bg)" strokeWidth="0.7" />;
            })() : null}
          </svg>
          <div className="mt-2 flex items-center justify-between text-[11px] text-subtle"><span>{replaySeries[0]?.d}</span><span>{activePoint?.d}</span><span>{replaySeries.at(-1)?.d}</span></div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted"><span>{priceSeries.length ? "Price overlay uses the nearest weekly close" : "Price overlay unavailable for this window"}</span>{activePricePoint ? <span className="font-mono text-bid">{activePricePoint.close.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span> : null}</div>
        </div>
        <div className="rounded-lg bg-bg p-4 text-xs leading-relaxed text-muted shadow-[var(--shadow-border)]"><p className="text-[10px] uppercase tracking-wide text-subtle">Read the replay</p><p className="mt-2">The vertical marker is the active historical week. Positioning stops at that point while the price overlay follows the same replay window.</p><p className="mt-3 text-subtle">This is historical context, not a price backtest.</p></div>
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