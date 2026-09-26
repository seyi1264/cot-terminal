import type { InstrumentReport } from "./types";

export type BriefingItem = {
  report: InstrumentReport;
  kind: "shift" | "extreme" | "flow";
  label: string;
  detail: string;
  magnitude: number;
};

export function buildBriefing(reports: InstrumentReport[], limit = 5): BriefingItem[] {
  return reports
    .map((report) => {
      const extreme = Math.max(report.woIndex, 100 - report.woIndex);
      const shift = Math.abs(report.woDiffChange);
      const flow = Math.abs(report.comm.dNet) + Math.abs(report.noncomm.dNet);

      if (extreme >= 90) {
        return {
          report,
          kind: "extreme" as const,
          label: "Extreme reading",
          detail: `WO difference is at the ${report.woIndex >= 50 ? "upper" : "lower"} end of its historical range (${report.woIndex.toFixed(0)}th percentile).`,
          magnitude: extreme + shift / 100_000,
        };
      }

      if (shift > 5_000) {
        return {
          report,
          kind: "shift" as const,
          label: "Largest weekly shift",
          detail: `White Oak difference ${report.woDiffChange >= 0 ? "rose" : "fell"} ${Math.abs(report.woDiffChange).toLocaleString()} contracts.`,
          magnitude: shift,
        };
      }

      return {
        report,
        kind: "flow" as const,
        label: "Active flow",
        detail: `${report.noncomm.flow.label}; commercials ${report.comm.flow.woLabel.toLowerCase()}.`,
        magnitude: flow,
      };
    })
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, limit);
}