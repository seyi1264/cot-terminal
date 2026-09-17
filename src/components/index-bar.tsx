import { cn } from "@/lib/utils";

export function IndexBar({
  value,
  className,
  label,
}: {
  value: number;
  className?: string;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const tone =
    clamped <= 20 ? "bg-offer" : clamped >= 80 ? "bg-bid" : "bg-accent";
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-muted">{label}</span>
          <span className="font-mono text-xs tabular text-fg">{clamped.toFixed(0)}</span>
        </div>
      ) : null}
      <div className="px-1">
        <div className="relative h-2 rounded-full bg-bg-subtle">
          <div className="absolute inset-y-0 left-0 w-1/5 rounded-l-full bg-offer/25" />
          <div className="absolute inset-y-0 right-0 w-1/5 rounded-r-full bg-bid/25" />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-accent/40"
            style={{ width: `${clamped}%` }}
          />
          <div
            className={cn(
              "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[var(--shadow-border)]",
              tone,
            )}
            style={{ left: `${clamped}%` }}
          />
        </div>
      </div>
    </div>
  );
}
