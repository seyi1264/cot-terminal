import { Download, Gauge, History, NotebookPen, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { getMarketPrice } from "@/lib/cot/price.functions";
import { formatSigned } from "@/lib/cot/format";
import type { InstrumentReport } from "@/lib/cot/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DeskTab = "confluence" | "replay" | "notes" | "calendar";

const PRICE_SYMBOLS: Record<string, string> = {
  EURUSD: "eurusd",
  GBPUSD: "gbpusd",
  USDJPY: "usdjpy",
  AUDUSD: "audusd",
  USDCAD: "usdcad",
  USDCHF: "usdchf",
  NZDUSD: "nzdusd",
  USDMXN: "usdmxn",
  DXY: "dxy",
  XAUUSD: "xauusd",
  XAGUSD: "xagusd",
  HG: "hg.f",
  CL: "cl.f",
  NG: "ng.f",
  ES: "es.f",
  NQ: "nq.f",
  ZN: "zn.f",
  ZB: "zb.f",
  BTC: "btcusd",
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
  const point = report.series[index] ?? report.series.at(-1);
  const latest = report.series.at(-1);
  const progress = report.series.length > 1 ? (index / (report.series.length - 1)) * 100 : 100;
  const [price, setPrice] = useState<{ close: number; date: string } | null>(null);

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

  return <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
    <div>
      <label className="text-xs text-muted">Instrument<select value={report.code} onChange={(event) => onCodeChange(event.target.value)} className="mt-1 h-9 w-full rounded-md bg-bg-elevated px-2 text-sm text-fg shadow-[var(--shadow-border)]">{reports.map((item) => <option key={item.code} value={item.code}>{item.symbol} · {item.name}</option>)}</select></label>
      <label className="mt-4 block text-xs text-muted">Historical week <input type="range" min="0" max={Math.max(0, report.series.length - 1)} value={index} onChange={(event) => onIndexChange(Number(event.target.value))} className="mt-3 w-full accent-[var(--color-accent)]" style={{ "--range-progress": `${progress}%` } as React.CSSProperties} /><span className="mt-2 flex justify-between font-mono text-[11px] text-subtle"><span>{report.series[0]?.d}</span><span>{point?.d}</span><span>{latest?.d}</span></span></label>
      <Button variant="quiet" size="sm" className="mt-5" onClick={() => onSelect(report.code)}>Open full detail</Button>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Metric label="WO difference" value={point ? formatSigned(point.w) : "—"} />
      <Metric label="Net specs" value={point ? formatSigned(point.n) : "—"} />
      <Metric label="Commercials" value={point ? formatSigned(point.c) : "—"} />
      <Metric label="Open interest" value={point ? point.o.toLocaleString() : "—"} />
      <div className="col-span-full mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-bg p-3 shadow-[var(--shadow-border)]"><p className="text-[10px] uppercase tracking-wide text-subtle">Latest price context</p><p className="mt-2 font-mono text-sm text-fg">{price ? price.close.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "Unavailable"}</p><p className="mt-1 text-xs text-muted">{price ? `Stooq daily close · ${price.date}` : "Price source did not return a quote."}</p></div>
        <div className="rounded-lg bg-bg p-3 text-xs leading-relaxed text-muted shadow-[var(--shadow-border)]">Replay is based on the historical COT print, before later weeks were known. Use it to inspect how positioning evolved, not as a price backtest.</div>
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
  const year = new Date().getUTCFullYear();
  const events = [
    ["Every Friday", "CFTC COT release", "Positioning refresh"],
    [`${year}-09-30`, "US employment report", "Rates / USD catalyst"],
    [`${year}-10-13`, "US CPI", "Inflation pulse"],
    [`${year}-10-28`, "FOMC decision", "Policy risk"],
    [`${year}-11-06`, "US employment report", "Rates / USD catalyst"],
    [`${year}-12-09`, "FOMC decision", "Policy risk"],
  ];
  return <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{events.map(([date, title, detail]) => <div key={`${date}-${title}`} className="rounded-lg bg-bg-elevated p-3 shadow-[var(--shadow-border)]"><p className="font-mono text-xs text-accent">{date}</p><p className="mt-2 text-sm font-medium text-fg">{title}</p><p className="mt-1 text-xs text-muted">{detail}</p></div>)}</div>;
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