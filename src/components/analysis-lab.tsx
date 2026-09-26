import { LineChart, NotebookPen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getMarketHistory } from "@/lib/cot/price.functions";
import { formatSigned } from "@/lib/cot/format";
import { stanceInPairQuote } from "@/lib/cot/instruments";
import { summarizeExtremeReversionAtHorizons } from "@/lib/cot/positioning-history";
import type { InstrumentReport } from "@/lib/cot/types";

const SYMBOLS: Record<string, string> = { EURUSD: "EURUSD=X", GBPUSD: "GBPUSD=X", USDJPY: "JPY=X", XAUUSD: "GC=F", CL: "CL=F", ES: "ES=F", NQ: "NQ=F", BTC: "BTC-USD", DXY: "DX-Y.NYB" };
type JournalEntry = { formed: string; cot: string; zone: string; trigger: string; result: string; note: string };
const EMPTY_ENTRY: JournalEntry = { formed: "", cot: "", zone: "", trigger: "", result: "", note: "" };

export function AnalysisLab({ reports }: { reports: InstrumentReport[] }) {
  const [code, setCode] = useState(reports[0]?.code ?? "");
  const [threshold, setThreshold] = useState(90);
  const [entry, setEntry] = useState<JournalEntry>(EMPTY_ENTRY);
  const [journalStats, setJournalStats] = useState({ total: 0, resolved: 0, wins: 0 });
  const report = useMemo(() => reports.find((item) => item.code === code) ?? reports[0], [reports, code]);
  const [prices, setPrices] = useState<Array<{ date: string; close: number }>>([]);
  const stats = useMemo(() => report
    ? summarizeExtremeReversionAtHorizons(report.series, threshold, [1, 4, 12])
    : { samples: 0, reversions: {}, reversionRates: {} }, [report, threshold]);
  useEffect(() => {
    const symbol = report ? SYMBOLS[report.pair] : undefined;
    if (!symbol) return;
    void getMarketHistory({ data: { symbol } }).then(setPrices).catch(() => setPrices([]));
  }, [report]);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("oak-ledger-journal") ?? "{}";
      const saved = (JSON.parse(raw) as Record<string, JournalEntry | string>)[code];
      setEntry(typeof saved === "string" ? { ...EMPTY_ENTRY, note: saved } : { ...EMPTY_ENTRY, ...saved });
      const entries = Object.values(JSON.parse(raw) as Record<string, JournalEntry | string>);
      const structured = entries.filter((item): item is JournalEntry => typeof item !== "string");
      const results = structured.map((item) => item.result.trim().toLowerCase());
      setJournalStats({
        total: structured.length,
        resolved: results.filter((result) => result && !result.includes("open")).length,
        wins: results.filter((result) => result.includes("win")).length,
      });
    } catch { setEntry(EMPTY_ENTRY); }
  }, [code]);

  const chart = useMemo(() => prices.slice(-26), [prices]);
  const min = useMemo(() => (chart.length ? Math.min(...chart.map((item) => item.close)) : 0), [chart]);
  const max = useMemo(() => (chart.length ? Math.max(...chart.map((item) => item.close)) : 0), [chart]);

  if (!report) return null;

  function saveEntry(patch: Partial<JournalEntry>) {
    const next = { ...entry, ...patch };
    setEntry(next);
    const raw = window.sessionStorage.getItem("oak-ledger-journal") ?? "{}";
    const all = JSON.parse(raw) as Record<string, JournalEntry>;
    window.sessionStorage.setItem("oak-ledger-journal", JSON.stringify({ ...all, [code]: next }));
  }

  return <section className="mt-8 border-y border-border py-6" aria-labelledby="analysis-lab-title">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] uppercase tracking-[0.16em] text-accent">Analysis lab</p><h2 id="analysis-lab-title" className="mt-1 font-display text-2xl font-medium tracking-tight text-fg">Positioning, price, and plan</h2></div></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-xs text-muted">Market<select value={code} onChange={(event) => setCode(event.target.value)} className="mt-1 h-9 w-full rounded-md bg-bg-elevated px-2 text-sm text-fg shadow-[var(--shadow-border)]">{reports.map((item) => <option key={item.code} value={item.code}>{item.symbol} · {item.name}</option>)}</select></label><label className="text-xs text-muted">Extreme threshold<select value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} className="mt-1 h-9 w-full rounded-md bg-bg-elevated px-2 text-sm text-fg shadow-[var(--shadow-border)]">{[80, 85, 90, 95].map((value) => <option key={value} value={value}>{value}% index or beyond</option>)}</select></label></div>
    <div className="mt-5 grid gap-2 sm:grid-cols-4"><Metric label="Extreme COT samples" value={String(stats.samples)} /><Metric label="1-week WO reversion" value={stats.samples ? `${stats.reversionRates[1]}%` : "—"} /><Metric label="4-week WO reversion" value={stats.samples ? `${stats.reversionRates[4]}%` : "—"} /><Metric label="12-week WO reversion" value={stats.samples ? `${stats.reversionRates[12]}%` : "—"} /></div>
    <p className="mt-2 text-xs text-subtle">Historical WO-difference reversion only; not price performance, trade probability, or a backtest.</p>
    <div className="mt-4 rounded-lg bg-bg-elevated p-4 shadow-[var(--shadow-border)]"><div className="flex items-center gap-2"><LineChart className="size-4 text-accent" /><h3 className="font-display text-lg text-fg">Weekly price context</h3><span className="ml-auto text-xs text-muted">{prices.length ? "Yahoo Finance" : "Unavailable"}</span></div>{chart.length > 1 ? <svg viewBox="0 0 520 150" className="mt-4 h-36 w-full" role="img" aria-label={`${report.symbol} weekly closing price chart`}><polyline points={chart.map((item, index) => `${(index / (chart.length - 1)) * 520},${145 - ((item.close - min) / Math.max(1e-9, max - min)) * 130}`).join(" ")} fill="none" stroke="var(--color-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg> : <p className="mt-4 text-sm text-muted">Price history is unavailable for this instrument.</p>}</div>
    <div className="mt-4"><div className="flex items-center gap-2"><NotebookPen className="size-4 text-accent" /><h3 className="font-display text-lg text-fg">Thesis journal</h3></div><div className="mt-3 grid gap-2 sm:grid-cols-3"><Metric label="Recorded theses" value={String(journalStats.total)} /><Metric label="Resolved" value={String(journalStats.resolved)} /><Metric label="Wins" value={String(journalStats.wins)} /></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><JournalField label="Date thesis formed" value={entry.formed} onChange={(value) => saveEntry({ formed: value })} type="date" /><JournalField label="COT reading at time" value={entry.cot} onChange={(value) => saveEntry({ cot: value })} placeholder={`${stanceInPairQuote(report.pair, report.stance)} · WO ${formatSigned(report.woDiff)}`} /><JournalField label="Zones identified" value={entry.zone} onChange={(value) => saveEntry({ zone: value })} placeholder="Demand / supply area" /><JournalField label="Entry trigger" value={entry.trigger} onChange={(value) => saveEntry({ trigger: value })} placeholder="What must price do?" /><JournalField label="Result" value={entry.result} onChange={(value) => saveEntry({ result: value })} placeholder="Open · Win · Loss · Invalidated" /></div><textarea value={entry.note} onChange={(event) => saveEntry({ note: event.target.value })} placeholder="Thesis notes, invalidation, review..." className="mt-3 min-h-24 w-full resize-y rounded-lg bg-bg-elevated p-3 text-sm leading-relaxed text-fg shadow-[var(--shadow-border)] placeholder:text-subtle" /><p className="mt-2 text-xs text-subtle">Saved in this session for the current analysis flow.</p></div>
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-bg p-3 shadow-[var(--shadow-border)]"><p className="text-[10px] uppercase tracking-wide text-subtle">{label}</p><p className="mt-2 font-mono text-sm tabular text-fg">{value}</p></div>; }
function JournalField({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: "text" | "date" }) { return <label className="text-xs text-muted">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 h-9 w-full rounded-md bg-bg-elevated px-2 text-sm text-fg shadow-[var(--shadow-border)] placeholder:text-subtle" /></label>; }