import { useEffect, useMemo, useState } from "react";
import { formatSigned } from "@/lib/cot/format";
import { INSTRUMENT_BY_CODE } from "@/lib/cot/instruments";
import { getCotInstrumentHistory } from "@/lib/cot/board.functions";
import { getMarketTimeframes, type MarketTimeframes } from "@/lib/cot/price.functions";
import { analyzeInstrument } from "@/lib/cot/white-oak";
import { readWhiteOakReplayPriceAction, type ReplayFrameRead } from "@/lib/cot/white-oak-replay";
import type { CotRawRow, InstrumentReport } from "@/lib/cot/types";
import { stanceInPairQuote } from "@/lib/cot/instruments";
import { cn } from "@/lib/utils";

export function WhiteOakMethodReplay({
  report,
  index,
  priceSymbol,
}: {
  report: InstrumentReport;
  index: number;
  priceSymbol: string | undefined;
}) {
  const point = report.series[index] ?? report.series.at(-1);
  const nextPoint = report.series[index + 1];
  const reportDate = point?.d;
  const [cotRows, setCotRows] = useState<CotRawRow[] | null>(null);
  const [cotStatus, setCotStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [timeframes, setTimeframes] = useState<MarketTimeframes | null>(null);
  const [priceStatus, setPriceStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    let active = true;
    setCotRows(null);
    setTimeframes(null);
    setCotStatus("loading");
    setPriceStatus("loading");
    void getCotInstrumentHistory({ data: { code: report.code } })
      .then((rows) => {
        if (!active) return;
        setCotRows(rows);
        setCotStatus("ready");
      })
      .catch(() => active && setCotStatus("unavailable"));
    if (priceSymbol) {
      void getMarketTimeframes({ data: { symbol: priceSymbol } })
        .then((data) => {
          if (!active) return;
          setTimeframes(data);
          setPriceStatus("ready");
        })
        .catch(() => active && setPriceStatus("unavailable"));
    } else {
      setPriceStatus("unavailable");
    }
    return () => { active = false; };
  }, [priceSymbol, report.code]);

  const historicalReport = useMemo(() => {
    const instrument = INSTRUMENT_BY_CODE[report.code];
    if (!cotRows || !instrument || !reportDate) return null;
    const pointInTimeRows = cotRows.filter((row) => row.report_date_as_yyyy_mm_dd <= reportDate);
    return analyzeInstrument(instrument, pointInTimeRows);
  }, [cotRows, report.code, reportDate]);

  const priceRead = useMemo(
    () => timeframes && reportDate
      ? readWhiteOakReplayPriceAction(timeframes, reportDate, nextPoint?.d)
      : null,
    [nextPoint?.d, reportDate, timeframes],
  );

  return (
    <section className="rounded-lg bg-bg p-4 text-xs leading-relaxed text-muted shadow-[var(--shadow-border)]" aria-label="White Oak method replay">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-accent">White Oak method replay</p>
          <p className="mt-1 text-[11px] text-subtle">CFTC position date {reportDate ?? "—"} · published the following Friday</p>
        </div>
        <span className="shrink-0 font-mono text-[10px] text-subtle">Actual history</span>
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <p className="text-[10px] uppercase tracking-wide text-subtle">Weekly positioning read</p>
        {cotStatus === "loading" ? <p className="mt-1">Loading this instrument's CFTC history…</p> : null}
        {cotStatus === "unavailable" ? <p className="mt-1">CFTC history is unavailable; no substitute or generated data is shown.</p> : null}
        {cotStatus === "ready" && !historicalReport ? <p className="mt-1">There are not enough CFTC reports before this date to form a White Oak read.</p> : null}
        {historicalReport ? (
          <>
            <p className="mt-1 font-medium text-fg">{stanceInPairQuote(report.pair, historicalReport.stance).replaceAll("-", " ").toUpperCase()} · {historicalReport.storyline?.cycle ?? "mixed"}</p>
            <p className="mt-1">{historicalReport.storyline?.summary}</p>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono tabular text-[11px] sm:grid-cols-4">
              <p>WO diff <span className="text-fg">{formatSigned(historicalReport.woDiff)}</span></p>
              <p>Specs net <span className="text-fg">{formatSigned(historicalReport.noncomm.net)}</span></p>
              <p>Commercial net <span className="text-fg">{formatSigned(historicalReport.comm.net)}</span></p>
              <p>Retail net <span className="text-fg">{formatSigned(historicalReport.retail.net)}</span></p>
            </div>
            <p className="mt-2 text-[11px]">{historicalReport.positioningWarning.summary}</p>
          </>
        ) : null}
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <p className="text-[10px] uppercase tracking-wide text-subtle">Top-down price sequence</p>
        {priceStatus === "loading" ? <p className="mt-1">Loading historical market candles…</p> : null}
        {priceStatus === "unavailable" ? <p className="mt-1">Historical market candles are unavailable for this instrument.</p> : null}
        {priceRead ? (
          <ol className="mt-2 space-y-2">
            <PriceStep number="01" title="Monthly structure" timeframe="monthly" frame={priceRead.monthly} />
            <PriceStep number="02" title="Weekly structure" timeframe="weekly" frame={priceRead.weekly} />
            <PriceStep number="03" title="Daily price context" timeframe="daily" frame={priceRead.daily} />
            <li className="grid grid-cols-[1.75rem_1fr] gap-2 border-t border-border/70 pt-2">
              <span className="font-mono text-[10px] text-subtle">04</span>
              <div>
                <p className="font-medium text-fg">Mapped supply / demand zone <span className="text-[10px] font-normal uppercase text-accent">Not assessed</span></p>
                <p className="mt-0.5">Historical trader-drawn zones are not archived, so the replay will not invent one.</p>
              </div>
            </li>
            <li className="grid grid-cols-[1.75rem_1fr] gap-2 border-t border-border/70 pt-2">
              <span className="font-mono text-[10px] text-subtle">05</span>
              <div>
                <p className="font-medium text-fg">4H / 1H reaction after release</p>
                <p className="mt-0.5">{priceRead.releaseDate} to {nextPoint?.d ?? "next COT snapshot pending"}</p>
                <p className="mt-1">4H: {frameSummary(priceRead.fourHour, "4H")}</p>
                <p>1H: {frameSummary(priceRead.oneHour, "1H")}</p>
              </div>
            </li>
          </ol>
        ) : null}
      </div>

      <p className="mt-3 border-t border-border pt-3 text-[10px] text-subtle">
        Monthly, weekly, and daily reads use completed candles before the CFTC Friday release. Entry-timeframe reads stop before the next Tuesday position snapshot. No trade or historical zone is inferred.
      </p>
    </section>
  );
}

function PriceStep({
  number,
  title,
  timeframe,
  frame,
}: {
  number: string;
  title: string;
  timeframe: string;
  frame: ReplayFrameRead;
}) {
  const stateLabel = frame.status === "available"
    ? frame.read?.structure ?? "Read available"
    : frame.status === "insufficient"
      ? "Insufficient history"
      : frame.status === "outside-coverage"
        ? "Outside data coverage"
        : "Awaiting next report";
  return (
    <li className="grid grid-cols-[1.75rem_1fr] gap-2 border-t border-border/70 pt-2">
      <span className="font-mono text-[10px] text-subtle">{number}</span>
      <div>
        <p className="font-medium text-fg">{title} <span className={cn("text-[10px] font-normal uppercase", frame.status === "available" ? "text-accent" : "text-subtle")}>{stateLabel}</span></p>
        <p className="mt-0.5">{frameSummary(frame, timeframe)}</p>
      </div>
    </li>
  );
}

function frameSummary(frame: ReplayFrameRead, timeframe: string): string {
  if (frame.status === "outside-coverage") return `${timeframe} history does not cover this date.`;
  if (frame.status === "awaiting-next-report") return "No completed post-release window until the next COT snapshot is available.";
  if (!frame.read) return "No price-action read is available.";
  if (frame.status === "insufficient") return frame.read.summary;
  return `${frame.read.trigger} · ${frame.read.momentumShift} · ${frame.read.trendline}. ${frame.read.summary}`;
}