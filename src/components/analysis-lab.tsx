import { Bell, Download, LineChart, NotebookPen, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getMarketHistory } from "@/lib/cot/price.functions";
import { formatSigned } from "@/lib/cot/format";
import type { InstrumentReport } from "@/lib/cot/types";
import { Button } from "@/components/ui/button";

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
  const stats = useMemo(() => (report ? backtest(report, threshold) : { samples: 0, one: 0, four: 0, twelve: 0 }), [report, threshold]);
  const browserPushReady = typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";
  const pushSummary = browserPushReady
    ? "Browser alerts are active on this device. The watchlist will notify once the subscription is confirmed."
    : "Notification permission is required before browser alerts can fire for this device.";

  useEffect(() => {
    const symbol = report ? SYMBOLS[report.pair] : undefined;
    if (!symbol) return;
    void getMarketHistory({ data: { symbol } }).then(setPrices).catch(() => setPrices([]));
  }, [report]);

  useEffect(() => {
    try {
      const saved = (JSON.parse(localStorage.getItem("oak-ledger-journal") ?? "{}") as Record<string, JournalEntry | string>)[code];
      setEntry(typeof saved === "string" ? { ...EMPTY_ENTRY, note: saved } : { ...EMPTY_ENTRY, ...saved });
      const entries = Object.values(JSON.parse(localStorage.getItem("oak-ledger-journal") ?? "{}") as Record<string, JournalEntry | string>);
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
    const all = JSON.parse(localStorage.getItem("oak-ledger-journal") ?? "{}") as Record<string, JournalEntry>;
    localStorage.setItem("oak-ledger-journal", JSON.stringify({ ...all, [code]: next }));
  }

  function shareReport() {
    const text = `${report.symbol} weekly report\nWO ${formatSigned(report.woDiff)} (${report.stance})\n4-week price-aware sample: ${stats.four}%\n${entry.note}`;
    if (navigator.share) void navigator.share({ title: `${report.symbol} weekly report`, text });
    else void navigator.clipboard.writeText(text);
  }

  return <section className="mt-8 border-y border-border py-6" aria-labelledby="analysis-lab-title">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] uppercase tracking-[0.16em] text-accent">Analysis lab</p><h2 id="analysis-lab-title" className="mt-1 font-display text-2xl font-medium tracking-tight text-fg">Price, probability, and plan</h2></div><div className="flex gap-2"><Button variant="quiet" size="sm" onClick={shareReport}><Share2 className="size-3.5" /> Share report</Button><Button variant="quiet" size="sm" onClick={() => downloadReport(report, stats, entry.note)}><Download className="size-3.5" /> Download</Button></div></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-xs text-muted">Market<select value={code} onChange={(event) => setCode(event.target.value)} className="mt-1 h-9 w-full rounded-md bg-bg-elevated px-2 text-sm text-fg shadow-[var(--shadow-border)]">{reports.map((item) => <option key={item.code} value={item.code}>{item.symbol} · {item.name}</option>)}</select></label><label className="text-xs text-muted">Extreme threshold<select value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} className="mt-1 h-9 w-full rounded-md bg-bg-elevated px-2 text-sm text-fg shadow-[var(--shadow-border)]">{[80, 85, 90, 95].map((value) => <option key={value} value={value}>{value}% index or beyond</option>)}</select></label></div>
    <div className="mt-5 grid gap-2 sm:grid-cols-4"><Metric label="Extreme samples" value={String(stats.samples)} /><Metric label="1-week follow-through" value={stats.samples ? `${stats.one}%` : "—"} /><Metric label="4-week follow-through" value={stats.samples ? `${stats.four}%` : "—"} /><Metric label="12-week follow-through" value={stats.samples ? `${stats.twelve}%` : "—"} /></div>
    <div className="mt-4 rounded-lg bg-bg-elevated p-4 shadow-[var(--shadow-border)]"><div className="flex items-center gap-2"><LineChart className="size-4 text-accent" /><h3 className="font-display text-lg text-fg">Weekly price context</h3><span className="ml-auto text-xs text-muted">{prices.length ? "Yahoo Finance" : "Unavailable"}</span></div>{chart.length > 1 ? <svg viewBox="0 0 520 150" className="mt-4 h-36 w-full" role="img" aria-label={`${report.symbol} weekly closing price chart`}><polyline points={chart.map((item, index) => `${(index / (chart.length - 1)) * 520},${145 - ((item.close - min) / Math.max(1e-9, max - min)) * 130}`).join(" ")} fill="none" stroke="var(--color-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg> : <p className="mt-4 text-sm text-muted">Price history is unavailable for this instrument.</p>}</div>
    <div className="mt-4"><div className="flex items-center gap-2"><NotebookPen className="size-4 text-accent" /><h3 className="font-display text-lg text-fg">Thesis journal</h3></div><div className="mt-3 grid gap-2 sm:grid-cols-3"><Metric label="Recorded theses" value={String(journalStats.total)} /><Metric label="Resolved" value={String(journalStats.resolved)} /><Metric label="Wins" value={String(journalStats.wins)} /></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><JournalField label="Date thesis formed" value={entry.formed} onChange={(value) => saveEntry({ formed: value })} type="date" /><JournalField label="COT reading at time" value={entry.cot} onChange={(value) => saveEntry({ cot: value })} placeholder={`${report.stance} · WO ${formatSigned(report.woDiff)}`} /><JournalField label="Zones identified" value={entry.zone} onChange={(value) => saveEntry({ zone: value })} placeholder="Demand / supply area" /><JournalField label="Entry trigger" value={entry.trigger} onChange={(value) => saveEntry({ trigger: value })} placeholder="What must price do?" /><JournalField label="Result" value={entry.result} onChange={(value) => saveEntry({ result: value })} placeholder="Open · Win · Loss · Invalidated" /></div><textarea value={entry.note} onChange={(event) => saveEntry({ note: event.target.value })} placeholder="Thesis notes, invalidation, review..." className="mt-3 min-h-24 w-full resize-y rounded-lg bg-bg-elevated p-3 text-sm leading-relaxed text-fg shadow-[var(--shadow-border)] placeholder:text-subtle" /><p className="mt-2 text-xs text-subtle">Saved locally on this device.</p></div>
    <div className="mt-4 flex items-start gap-3 rounded-lg bg-bg-elevated p-3 shadow-[var(--shadow-border)]"><Bell className="mt-0.5 size-4 text-accent" /><div><p className="text-sm text-fg">Alert delivery</p><p className="mt-1 text-xs leading-relaxed text-muted">{pushSummary}</p></div></div>
  </section>;
}

function backtest(report: InstrumentReport, threshold: number) { const hits = [0, 0, 0]; let samples = 0; for (let index = 12; index < report.series.length - 12; index += 1) { const history = report.series.slice(0, index + 1).map((point) => point.w); const max = Math.max(...history); const min = Math.min(...history); const percentile = max === min ? 50 : ((report.series[index]!.w - min) / (max - min)) * 100; if (percentile < threshold && percentile > 100 - threshold) continue; const direction = percentile >= 50 ? 1 : -1; samples += 1; [1, 4, 12].forEach((horizon, position) => { if ((report.series[index + horizon]!.w - report.series[index]!.w) * direction >= 0) hits[position] += 1; }); } return { samples, one: samples ? Math.round(hits[0]! / samples * 100) : 0, four: samples ? Math.round(hits[1]! / samples * 100) : 0, twelve: samples ? Math.round(hits[2]! / samples * 100) : 0 }; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-bg p-3 shadow-[var(--shadow-border)]"><p className="text-[10px] uppercase tracking-wide text-subtle">{label}</p><p className="mt-2 font-mono text-sm tabular text-fg">{value}</p></div>; }
function JournalField({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: "text" | "date" }) { return <label className="text-xs text-muted">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 h-9 w-full rounded-md bg-bg-elevated px-2 text-sm text-fg shadow-[var(--shadow-border)] placeholder:text-subtle" /></label>; }
function downloadReport(report: InstrumentReport, stats: { samples: number; one: number; four: number; twelve: number }, note: string) { const text = `${report.symbol} weekly report\nWO ${formatSigned(report.woDiff)} (${report.stance})\n1w ${stats.one}% | 4w ${stats.four}% | 12w ${stats.twelve}%\n\n${note}`; const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([text], { type: "text/plain" })); link.download = `${report.symbol.toLowerCase()}-weekly-report.txt`; link.click(); }