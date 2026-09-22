import * as Dialog from "@radix-ui/react-dialog";
import { Info, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatContracts, formatDate, formatSigned } from "@/lib/cot/format";
import { getMarketHistory, getMarketPrice } from "@/lib/cot/price.functions";
import { listThesisZones, type ThesisZone } from "@/lib/cot/zones.functions";
import type { InstrumentReport } from "@/lib/cot/types";
import {
  interpretOpenInterestContext,
  summarizeRetailDivergence,
} from "@/lib/cot/white-oak";
import { GroupStats } from "@/components/group-stats";
import { IndexBar } from "@/components/index-bar";
import { NetChart, WoChart } from "@/components/net-chart";
import { NewsFeed } from "@/components/news-feed";
import { StanceChip } from "@/components/stance-chip";
import { Button } from "@/components/ui/button";
import { ZoneEditor } from "@/components/zone-editor";
import { cn } from "@/lib/utils";

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

type MarketConfirmation = {
  status: "loading" | "ready" | "unavailable";
  currentPrice: number | null;
  previousClose: number | null;
  zone: ThesisZone | null;
};

export function DetailPanel({
  report,
  open,
  onClose,
}: {
  report: InstrumentReport | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-bg/70 data-[state=open]:animate-in" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col overflow-y-auto bg-bg-elevated shadow-[var(--shadow-border)] outline-none data-[state=open]:animate-in"
          aria-describedby={undefined}
        >
          {report ? <DetailBody report={report} onClose={onClose} /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DetailBody({
  report,
  onClose,
}: {
  report: InstrumentReport;
  onClose: () => void;
}) {
  const [marketConfirmation, setMarketConfirmation] = useState<MarketConfirmation>({
    status: "loading",
    currentPrice: null,
    previousClose: null,
    zone: null,
  });
  const recent = useMemo(() => [...report.series].slice(-13).reverse(), [report.series]);
  const signalChecklist = useMemo(() => {
    const distributionSetup = report.comm.net < 0 && report.noncomm.net > 0 && report.retail.net > 0 && report.woDiff > 0;
    const commercialExit = report.comm.net < 0 && report.comm.dNet > 0 && report.oiChange < 0;
    const freshAccumulation = report.comm.net > 0 && report.comm.dNet > 0 && report.oiChange > 0;
    const dxyCorrelation = report.symbol === "DXY";
    return [
      { label: "Distribution setup", active: distributionSetup, detail: "Commercials short while specs and retail are long can frame a top-risk context." },
      { label: "Commercial exit signal", active: commercialExit, detail: "Shorts shrinking with falling OI can signal early profit-taking / unwind risk." },
      { label: "Fresh long accumulation", active: freshAccumulation, detail: "Rising OI with stronger commercial longs is a stronger conviction read than simple short covering." },
      { label: "Macro correlation", active: dxyCorrelation, detail: "DXY weakness often aligns with EUR/USD, GBP/USD and gold strength, while USD/CHF and USD/JPY can soften." },
    ];
  }, [report]);

  const oiContext = useMemo(
    () =>
      interpretOpenInterestContext({
        oiChange: report.oiChange,
        priceChange: report.woDiffChange,
        commercialNet: report.comm.net,
        woDiff: report.woDiff,
      }),
    [report.comm.net, report.oiChange, report.woDiff, report.woDiffChange],
  );

  const retailContext = useMemo(
    () =>
      summarizeRetailDivergence({
        retailNet: report.retail.net,
        woDiff: report.woDiff,
        retailExtreme: Math.max(report.retail.index, 100 - report.retail.index),
        stance: report.stance,
      }),
    [report.retail.index, report.retail.net, report.stance, report.woDiff],
  );

  const methodology = report.storyline;
  const zone = report.zone;
  const trendline = report.trendline;
  const sherlock = report.sherlock ?? [];
  const pressure = report.pressure;
  const confluence = report.confluence;
  const weeklyBias = report.weeklyBias ?? "";

  useEffect(() => {
    let active = true;
    const symbol = PRICE_SYMBOLS[report.pair];
    setMarketConfirmation({ status: "loading", currentPrice: null, previousClose: null, zone: null });
    if (!symbol) {
      setMarketConfirmation((current) => ({ ...current, status: "unavailable" }));
      return () => { active = false; };
    }
    void Promise.all([
      getMarketPrice({ data: { symbol } }),
      getMarketHistory({ data: { symbol } }),
      listThesisZones().catch(() => [] as ThesisZone[]),
    ]).then(([price, history, zones]) => {
      if (!active) return;
      const currentZone = zones.find((zone) => zone.instrumentCode === report.code && zone.active && zone.quality !== "removed") ?? null;
      setMarketConfirmation({
        status: "ready",
        currentPrice: price.close,
        previousClose: history.at(-2)?.close ?? null,
        zone: currentZone,
      });
    }).catch(() => {
      if (active) setMarketConfirmation({ status: "unavailable", currentPrice: null, previousClose: null, zone: null });
    });
    return () => { active = false; };
  }, [report.code, report.pair]);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-bg-elevated/95 px-5 py-4 backdrop-blur-sm">
        <div>
          <Dialog.Title className="font-display text-2xl font-medium tracking-tight text-fg">
            {report.symbol}
            {report.pair !== report.symbol ? (
              <span className="ml-2 text-base text-muted">{report.pair}</span>
            ) : null}
          </Dialog.Title>
          <p className="mt-1 text-sm text-muted">
            {report.name} · {report.exchange} · as of {formatDate(report.asOf)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StanceChip stance={report.stance} />
          <Button variant="quiet" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </Button>
        </div>
      </header>

      <div className="space-y-8 px-5 py-6">
        <section className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-start">
          <span className={cn(
            "inline-flex h-fit items-center justify-center rounded-full border px-3 py-1 text-[10px] font-semibold tracking-[0.14em]",
            report.thesisStatus === "CONFIRMED" && "border-bid/40 bg-bid/10 text-bid",
            report.thesisStatus === "ACTIVE" && "border-accent/50 bg-accent/10 text-accent",
            report.thesisStatus === "FORMING" && "border-border bg-bg-subtle text-muted",
            report.thesisStatus === "EXPIRED" && "border-offer/40 bg-offer/10 text-offer",
          )}>{report.thesisStatus}</span>
          <div className="rounded-lg border border-accent/55 bg-[#272118] p-4 shadow-[0_0_0_1px_rgb(200_192_176_/_0.08)]">
            <div className="flex items-center gap-2 text-accent">
              <Info className="size-4" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">Trigger logic: {report.triggerLogic.label}</p>
            </div>
            <p className="mt-2 text-sm font-medium leading-relaxed text-fg">{report.triggerLogic.rule}</p>
            <p className="mt-2 text-xs text-muted">{report.triggerLogic.matched ? "All listed conditions are currently present in the report." : "The directional label is supported by the wider score; this exact trigger is not fully matched yet."}</p>
          </div>
        </section>

        <TradingSignalPanel signal={report.tradingSignal} market={marketConfirmation} />

        <section>
          <p className="text-[11px] uppercase tracking-wide text-subtle">White Oak reading</p>
          <h3 className="mt-1 font-display text-xl text-fg">{report.headline}</h3>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">{report.body}</p>

          <div className="mt-4 rounded-lg border border-border bg-bg p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-subtle">Institutional signal checklist</p>
            <ul className="mt-3 space-y-2">
              {signalChecklist.map((item) => (
                <li key={item.label} className="flex items-start gap-2 text-sm text-fg">
                  <span className={item.active ? "mt-0.5 inline-flex size-2.5 rounded-full bg-accent" : "mt-0.5 inline-flex size-2.5 rounded-full bg-border"} aria-hidden="true" />
                  <span>
                    <span className="font-medium text-fg">{item.label}:</span> {item.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {report.comm.net < 0 && report.noncomm.net > 0 && report.retail.net > 0 && report.woDiff > 0 ? (
            <div className="mt-4 rounded-lg border border-accent/55 bg-[#272118] p-4 text-sm leading-relaxed text-fg shadow-[0_0_0_1px_rgb(200_192_176_/_0.08)]">
              <span className="font-medium text-accent">Framework context:</span> this pattern can read as a
              distribution / top-risk setup when commercials are short while specs and retail are long.
              It is a useful context flag, not a certainty trigger by itself.
            </div>
          ) : null}
          {report.symbol === "DXY" && report.comm.net < 0 && report.noncomm.net > 0 ? (
            <div className="mt-3 rounded-lg border border-border bg-bg p-3 text-sm leading-relaxed text-muted">
              <span className="font-medium text-fg">Cross-market framework:</span> DXY weakness can often
              align with EUR/USD and GBP/USD strength and gold support, while USD/CHF and USD/JPY can
              soften as the dollar loses relative strength. This is directional context, not a guarantee.
            </div>
          ) : null}
          {report.flags.length > 1 ? (
            <ul className="mt-4 space-y-1.5">
              {report.flags.slice(1).map((flag) => (
                <li key={flag} className="text-sm text-fg">
                  {flag}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="WO difference" value={formatSigned(report.woDiff)} tone={report.woDiff >= 0 ? "bid" : "offer"} />
          <Stat label="Week change" value={formatSigned(report.woDiffChange)} />
          <Stat label="Open interest" value={formatContracts(report.oi)} hint={formatSigned(report.oiChange)} />
          <Stat label="13-week WO avg" value={formatSigned(report.woAvg13)} />
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          <DecisionCard
            title="Open interest read"
            tone={oiContext.tone}
            label={oiContext.label}
            confidence={oiContext.confidence}
          />
          <DecisionCard
            title="Retail divergence"
            tone={retailContext.tone}
            label={retailContext.label}
            confidence={retailContext.confidence}
          />
        </section>

        {methodology ? (
          <section className="rounded-lg border border-border bg-bg p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-subtle">Market storyline</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.12em] text-muted">
              <span className="rounded-full border border-border px-2 py-1">Control: {methodology.whoInControl}</span>
              <span className="rounded-full border border-border px-2 py-1">Shift: {methodology.controlShift}</span>
              <span className="rounded-full border border-border px-2 py-1">Cycle: {methodology.cycle}</span>
              <span className="rounded-full border border-border px-2 py-1">COT check: {methodology.confirmation}</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{methodology.summary}</p>
          </section>
        ) : null}

        {zone || trendline || pressure ? (
          <section className="grid gap-3 md:grid-cols-3">
            {zone ? (
              <div className="rounded-lg border border-border bg-bg p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-subtle">Supply & demand</p>
                <p className="mt-2 font-medium text-fg">{zone.label}</p>
                <p className="mt-2 text-xs text-muted">Quality: {zone.quality}</p>
                <p className="text-xs text-muted">Proximity: {zone.proximity}</p>
                <p className="mt-2 text-xs text-fg">Alignment: {zone.alignment}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">{zone.reminder}</p>
              </div>
            ) : null}
            {trendline ? (
              <div className="rounded-lg border border-border bg-bg p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-subtle">Institutional trendline</p>
                <p className="mt-2 font-medium text-fg">{trendline.status}</p>
                <p className="mt-2 text-xs text-muted">Direction: {trendline.direction}</p>
                <p className="text-xs text-fg">Alignment: {trendline.alignment}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">{trendline.summary}</p>
              </div>
            ) : null}
            {pressure ? (
              <div className="rounded-lg border border-border bg-bg p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-subtle">Pressure</p>
                <p className="mt-2 font-medium text-fg">{pressure.state}</p>
                <p className="mt-2 text-xs text-fg">Cross-reference: {pressure.crossReference}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">{pressure.alert}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        {sherlock.length ? (
          <section className="rounded-lg border border-border bg-bg p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-subtle">Sherlock process</p>
            <div className="mt-3 space-y-2">
              {sherlock.map((step) => (
                <div key={step.label} className="flex gap-3 rounded-md border border-border bg-bg-elevated p-2.5">
                  <span className={step.state === "check" ? "mt-0.5 size-2.5 rounded-full bg-bid" : step.state === "watch" ? "mt-0.5 size-2.5 rounded-full bg-muted" : "mt-0.5 size-2.5 rounded-full bg-offer"} />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-fg">{step.label}</p>
                    <p className="mt-1 text-sm text-muted">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {weeklyBias ? (
          <section className="rounded-lg border border-accent/25 bg-accent/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-subtle">Weekly bias statement</p>
            <pre className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg">{weeklyBias}</pre>
          </section>
        ) : null}

        <SynthesisPanel report={report} />

        <ZoneEditor report={report} />

        {confluence ? (
          <section className="rounded-lg border border-border bg-bg p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-subtle">Confluence score</p>
                <p className="mt-1 font-display text-xl text-fg">{confluence.label}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-2xl text-fg">{confluence.score}/{confluence.total}</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted">Confirmations stacked</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{confluence.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {confluence.checks.map((item) => (
                <span key={item.label} className={item.active ? "rounded-full border border-bid/35 bg-bid/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-bid" : "rounded-full border border-border px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-muted"}>
                  {item.label}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {report.historical ? (
          <section className="rounded-lg border border-border bg-bg p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-subtle">Historical setup performance</p>
            <p className="mt-2 font-medium text-fg">{report.historical.label}</p>
            <p className="mt-2 text-sm text-fg">{report.historical.conviction}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{report.historical.summary}</p>
          </section>
        ) : null}

        <IndexBar value={report.woIndex} label="White Oak difference, all-history index (0–100)" />

        <div className="grid gap-3 md:grid-cols-3">
          <GroupStats
            title="Non-commercial"
            subtitle="Large specs — they bet with the move"
            snap={report.noncomm}
          />
          <GroupStats
            title="Commercial"
            subtitle="Hedgers — invert: shorts confirm a rise"
            snap={report.comm}
          />
          <GroupStats
            title="Retail"
            subtitle="Non-reportable — often wrong at extremes"
            snap={report.retail}
          />
        </div>

        <section>
          <h3 className="mb-3 font-display text-lg text-fg">Net positions</h3>
          <NetChart series={report.series} />
        </section>

        <section>
          <h3 className="mb-3 font-display text-lg text-fg">WO difference</h3>
          <p className="mb-3 max-w-prose text-sm text-muted">
            Non-commercial net minus commercial net. Two minuses make a plus: specs long and
            commercials short reads as a combined institutional bid.
          </p>
          <WoChart series={report.series} />
        </section>

        <section>
          <NewsFeed symbol={report.pair} stance={report.stance} />
        </section>

        <section>
          <h3 className="mb-3 font-display text-lg text-fg">Last 13 weeks</h3>
          <div className="overflow-x-auto rounded-lg shadow-[var(--shadow-border)]">
            <table className="w-full min-w-[36rem] text-left text-xs">
              <thead className="bg-bg-subtle text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Week</th>
                  <th className="px-3 py-2 font-medium">NC net</th>
                  <th className="px-3 py-2 font-medium">Comm net</th>
                  <th className="px-3 py-2 font-medium">Retail</th>
                  <th className="px-3 py-2 font-medium">WO diff</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={row.d} className="border-t border-border">
                    <td className="px-3 py-2 text-muted">{formatDate(row.d)}</td>
                    <td className="px-3 py-2 font-mono tabular">{formatSigned(row.n)}</td>
                    <td className="px-3 py-2 font-mono tabular">{formatSigned(row.c)}</td>
                    <td className="px-3 py-2 font-mono tabular">{formatSigned(row.r)}</td>
                    <td className="px-3 py-2 font-mono tabular">{formatSigned(row.w)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function SynthesisPanel({ report }: { report: InstrumentReport }) {
  const directional = report.stance === "bid" || report.stance === "strong-bid";
  const watchFor = directional
    ? `A reaction from the ${report.zone?.label.toLowerCase() ?? "demand zone"}, followed by ${report.trendline?.direction.toLowerCase() ?? "bullish"} alignment on the entry timeframe.`
    : report.stance === "offer" || report.stance === "strong-offer"
      ? `A rejection from the ${report.zone?.label.toLowerCase() ?? "supply zone"}, followed by bearish alignment on the entry timeframe.`
      : "A fresh supply or demand break that moves the positioning read out of balance.";
  const invalidate = report.zone?.quality === "Stale"
    ? "The current zone is already stale; wait for a new structural zone before acting."
    : directional
      ? "A daily close through demand, pressure turning bearish, or the institutional book unwinding its bid."
      : report.stance === "offer" || report.stance === "strong-offer"
        ? "A daily close through supply, pressure turning bullish, or the institutional book unwinding its offer."
        : "No directional trigger appears; the thesis remains a wait state rather than a trade.";

  return (
    <section className="rounded-lg border border-accent/55 bg-[#272118] p-4 shadow-[0_0_0_1px_rgb(200_192_176_/_0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Complete picture</p>
          <h3 className="mt-1 font-display text-xl text-fg">The thesis is {report.thesisStatus.toLowerCase()}</h3>
        </div>
        <span className="font-mono text-sm text-accent">{report.confluence ? `${report.confluence.score}/${report.confluence.total}` : "—"}</span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-fg">{report.storyline?.summary ?? report.body}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-bg/60 p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-bid">Watch for</p><p className="mt-1 text-sm leading-relaxed text-fg">{watchFor}</p></div>
        <div className="rounded-md bg-bg/60 p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-offer">Invalidation</p><p className="mt-1 text-sm leading-relaxed text-fg">{invalidate}</p></div>
      </div>
    </section>
  );
}

function DecisionCard({
  title,
  tone,
  label,
  confidence,
}: {
  title: string;
  tone: "strong-bid" | "bid" | "cautious" | "offer" | "strong-offer" | "neutral" | "warning" | "caution";
  label: string;
  confidence: number;
}) {
  const toneClass =
    tone === "strong-bid" || tone === "bid"
      ? "border-bid/25 bg-bid/5 text-bid"
      : tone === "strong-offer" || tone === "offer"
        ? "border-offer/25 bg-offer/5 text-offer"
        : tone === "warning"
          ? "border-amber-400/35 bg-amber-500/5 text-amber-300"
          : tone === "cautious"
            ? "border-border bg-bg-subtle text-fg"
            : "border-border bg-bg-subtle text-muted";

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-current/80">{title}</p>
        <span className="text-[10px] uppercase tracking-[0.12em] text-current/80">{confidence}%</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-current">{label}</p>
    </div>
  );
}

function TradingSignalPanel({
  signal,
  market,
}: {
  signal: InstrumentReport["tradingSignal"];
  market: MarketConfirmation;
}) {
  const currentPrice = market.currentPrice;
  const previousClose = market.previousClose;
  const zoneDirection = market.zone?.direction;
  const insideZone = currentPrice !== null && market.zone !== null
    && currentPrice >= market.zone.lowerPrice
    && currentPrice <= market.zone.upperPrice;
  const priceConfirmed = insideZone && previousClose !== null && currentPrice !== null
    && ((zoneDirection === "demand" && currentPrice > previousClose)
      || (zoneDirection === "supply" && currentPrice < previousClose));
  const aligned = signal.label === "COT context aligned";
  const action = aligned && priceConfirmed
    ? zoneDirection === "demand" ? "LONG" : "SHORT"
    : "WAIT";
  const tone = action === "LONG" ? "border-bid/40 bg-bid/10" : action === "SHORT" ? "border-offer/40 bg-offer/10" : "border-accent/40 bg-accent/10";
  const actionTone = action === "LONG" ? "text-bid" : action === "SHORT" ? "text-offer" : "text-accent";
  const summary = market.status === "loading"
    ? "Checking current price and your saved institutional zone."
    : market.status === "unavailable"
      ? "Live price confirmation is unavailable. COT data is context only; no trade signal is issued."
      : !market.zone
        ? "No active saved supply or demand zone exists for this instrument. Save and validate a zone before considering an entry."
        : !insideZone
          ? `Price is not inside the saved ${market.zone.direction} zone. Wait for price to reach the zone before looking for confirmation.`
          : !priceConfirmed
            ? "Price is inside the saved zone, but the latest move has not confirmed the zone direction yet."
            : signal.summary;
  return (
    <section className={`rounded-lg border p-4 ${tone}`} aria-label="Trading signal">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">Trading signal</p>
          <h2 className={`mt-1 font-display text-2xl ${actionTone}`}>{action}</h2>
        </div>
        <span className="rounded-full border border-current/30 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-current">{signal.label}</span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-fg">{summary}</p>
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <p className="rounded-md bg-bg/50 p-2 text-muted">Commercial/institutional flow: <strong className="text-fg">{signal.institutional}</strong></p>
        <p className="rounded-md bg-bg/50 p-2 text-muted">Large-speculator direction: <strong className="text-fg">{signal.speculators}</strong></p>
      </div>
      <p className="mt-2 text-xs text-muted">
        {market.currentPrice !== null ? `Live price: ${market.currentPrice}` : "Live price: unavailable"}
        {market.zone ? ` · Saved zone: ${market.zone.lowerPrice}–${market.zone.upperPrice} ${market.zone.direction}` : " · Saved zone: none"}
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "bid" | "offer";
}) {
  return (
    <div className="rounded-lg bg-bg p-3 shadow-[var(--shadow-border)]">
      <p className="text-[11px] uppercase tracking-wide text-subtle">{label}</p>
      <p
        className={
          tone === "bid"
            ? "mt-1 font-mono text-lg tabular text-bid"
            : tone === "offer"
              ? "mt-1 font-mono text-lg tabular text-offer"
              : "mt-1 font-mono text-lg tabular text-fg"
        }
      >
        {value}
      </p>
      {hint ? <p className="font-mono text-xs tabular text-muted">{hint}</p> : null}
    </div>
  );
}
