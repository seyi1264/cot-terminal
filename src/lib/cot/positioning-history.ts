import type { InstrumentReport } from "./types";

export function summarizeExtremeReversionAtHorizons(
  series: Array<{ w: number }>,
  threshold: number,
  horizons: number[],
) {
  const maxHorizon = Math.max(...horizons, 0);
  const reversions = Object.fromEntries(horizons.map((horizon) => [horizon, 0])) as Record<number, number>;
  let samples = 0;

  for (let index = 12; index < series.length - maxHorizon; index += 1) {
    const current = series[index]!.w;
    const history = series.slice(0, index + 1).map((point) => point.w);
    const maximum = Math.max(...history);
    const minimum = Math.min(...history);
    const percentile = maximum === minimum ? 50 : ((current - minimum) / (maximum - minimum)) * 100;
    const upperExtreme = percentile >= threshold;
    const lowerExtreme = percentile <= 100 - threshold;
    if (!upperExtreme && !lowerExtreme) continue;
    samples += 1;

    for (const horizon of horizons) {
      const future = series[index + horizon]!.w;
      if ((upperExtreme && future < current) || (lowerExtreme && future > current)) {
        reversions[horizon] = reversions[horizon]! + 1;
      }
    }
  }

  return {
    samples,
    reversions,
    reversionRates: Object.fromEntries(
      horizons.map((horizon) => [horizon, samples ? Math.round((reversions[horizon]! / samples) * 100) : 0]),
    ) as Record<number, number>,
  };
}

export function summarizeExtremeReversion(reports: InstrumentReport[], threshold = 90) {
  let samples = 0;
  let reversions = 0;

  for (const report of reports) {
    const summary = summarizeExtremeReversionAtHorizons(report.series, threshold, [4]);
    samples += summary.samples;
    reversions += summary.reversions[4] ?? 0;
  }

  return {
    samples,
    reversions,
    reversionRate: samples ? Math.round((reversions / samples) * 100) : 0,
  };
}