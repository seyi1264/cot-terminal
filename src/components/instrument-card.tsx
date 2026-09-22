import { formatSigned } from "@/lib/cot/format";
import type { InstrumentReport } from "@/lib/cot/types";
import { IndexBar } from "@/components/index-bar";
import { Sparkline } from "@/components/sparkline";
import { StanceChip } from "@/components/stance-chip";
import { cn } from "@/lib/utils";

export function InstrumentCard({
  report,
  active,
  onOpen,
}: {
  report: InstrumentReport;
  active?: boolean;
  onOpen: () => void;
}) {
  const spark = report.series.slice(-26).map((p) => p.w);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full flex-col rounded-xl bg-bg-elevated p-5 text-left shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-(--motion-quick) ease-(--ease-out)",
        "hover:shadow-[var(--shadow-border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
        active && "ring-2 ring-ring/60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-xl font-medium tracking-tight text-fg">
              {report.symbol}
            </span>
            {report.pair !== report.symbol ? (
              <span className="text-xs text-subtle">{report.pair}</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {report.name} · {report.exchange}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StanceChip stance={report.stance} />
          <span className="text-[9px] font-semibold tracking-[0.12em] text-subtle">{report.thesisStatus}</span>
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-subtle">WO difference</p>
          <p
            className={cn(
              "mt-1 font-mono text-2xl tabular",
              report.woDiff >= 0 ? "text-bid" : "text-offer",
            )}
          >
            {formatSigned(report.woDiff)}
          </p>
          <p className="mt-0.5 font-mono text-xs tabular text-muted">
            week {formatSigned(report.woDiffChange)}
          </p>
        </div>
        <Sparkline values={spark} />
      </div>

      <div className="mt-4">
        <IndexBar value={report.woIndex} label="WO index (all)" />
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-subtle">Non-comm</dt>
          <dd className="mt-0.5 font-mono tabular text-fg">{formatSigned(report.noncomm.net)}</dd>
          <dd className="text-muted">{report.noncomm.flow.label}</dd>
        </div>
        <div>
          <dt className="text-subtle">Commercial</dt>
          <dd className="mt-0.5 font-mono tabular text-fg">{formatSigned(report.comm.net)}</dd>
          <dd className="text-muted">{report.comm.flow.woLabel}</dd>
        </div>
        <div>
          <dt className="text-subtle">Retail</dt>
          <dd className="mt-0.5 font-mono tabular text-fg">{formatSigned(report.retail.net)}</dd>
          <dd className="text-muted">{report.retail.flow.label}</dd>
        </div>
      </dl>

      {report.flags[0] ? (
        <p className="mt-4 line-clamp-2 text-xs leading-relaxed text-muted">{report.flags[0]}</p>
      ) : null}
    </button>
  );
}
