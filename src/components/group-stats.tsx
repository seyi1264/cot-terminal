import { formatPct, formatSigned } from "@/lib/cot/format";
import type { GroupSnapshot } from "@/lib/cot/types";
import { IndexBar } from "@/components/index-bar";

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="font-mono text-sm tabular text-fg">
        {value}
        {hint ? <span className="ml-2 text-xs text-subtle">{hint}</span> : null}
      </span>
    </div>
  );
}

export function GroupStats({
  title,
  subtitle,
  snap,
}: {
  title: string;
  subtitle: string;
  snap: GroupSnapshot;
}) {
  const netTone = snap.net > 0 ? "text-bid" : snap.net < 0 ? "text-offer" : "text-muted";
  return (
    <section className="rounded-lg bg-bg p-4 shadow-[var(--shadow-border)]">
      <header className="mb-3">
        <h3 className="font-display text-base font-medium text-fg">{title}</h3>
        <p className="text-xs text-muted">{subtitle}</p>
      </header>
      <p className={`font-mono text-2xl tabular ${netTone}`}>{formatSigned(snap.net)}</p>
      <p className="mt-1 text-xs text-muted">{snap.flow.woLabel}</p>
      <div className="mt-3 divide-y divide-border">
        <Row label="Longs" value={formatSigned(snap.long).replace("+", "")} hint={formatPct(snap.pctOiLong)} />
        <Row label="Shorts" value={formatSigned(snap.short).replace("+", "")} hint={formatPct(snap.pctOiShort)} />
        {snap.spread ? <Row label="Spreads" value={formatSigned(snap.spread).replace("+", "")} /> : null}
        <Row label="Week Δ longs" value={formatSigned(snap.dLong)} />
        <Row label="Week Δ shorts" value={formatSigned(snap.dShort)} />
        <Row label="Week Δ net" value={formatSigned(snap.dNet)} />
        <Row label="13-week avg" value={formatSigned(snap.avg13)} />
      </div>
      <div className="mt-4">
        <IndexBar value={snap.index} label="All-history index" />
      </div>
    </section>
  );
}
