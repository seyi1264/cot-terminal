import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { formatContracts, formatDate, formatSigned } from "@/lib/cot/format";
import type { InstrumentReport } from "@/lib/cot/types";
import { GroupStats } from "@/components/group-stats";
import { IndexBar } from "@/components/index-bar";
import { NetChart, WoChart } from "@/components/net-chart";
import { StanceChip } from "@/components/stance-chip";
import { Button } from "@/components/ui/button";

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
  const recent = [...report.series].slice(-13).reverse();
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
        <section>
          <p className="text-[11px] uppercase tracking-wide text-subtle">White Oak reading</p>
          <h3 className="mt-1 font-display text-xl text-fg">{report.headline}</h3>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">{report.body}</p>
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

        <IndexBar value={report.woIndex} label="White Oak difference, 3-year index (0–100)" />

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
