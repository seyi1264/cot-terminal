export type ReplayWindow = {
  start: number;
  end: number;
  startDate?: string;
  endDate?: string;
};

export function resolveReplayRange<T extends { d: string }>(series: T[], startDate?: string, endDate?: string): ReplayWindow {
  if (!series.length) return { start: 0, end: 0 };

  const safeStartDate = startDate ?? series[0].d;
  const safeEndDate = endDate ?? series.at(-1)?.d ?? series[0].d;

  let startIndex = 0;
  for (let index = 0; index < series.length; index += 1) {
    if (series[index].d === safeStartDate) {
      startIndex = index;
      break;
    }
  }

  let endIndex = series.length - 1;
  for (let index = series.length - 1; index >= 0; index -= 1) {
    if (series[index].d === safeEndDate) {
      endIndex = index;
      break;
    }
  }

  const boundedStart = Math.max(0, Math.min(startIndex, series.length - 1));
  const boundedEnd = Math.max(0, Math.min(endIndex, series.length - 1));

  return {
    start: Math.min(boundedStart, boundedEnd),
    end: Math.max(boundedStart, boundedEnd),
    startDate: series[Math.min(boundedStart, boundedEnd)]?.d ?? safeStartDate,
    endDate: series[Math.max(boundedStart, boundedEnd)]?.d ?? safeEndDate,
  };
}

export function clampReplayRange(total: number, start: number, end: number): { start: number; end: number } {
  const safeTotal = Math.max(1, total);
  const boundedStart = Math.max(0, Math.min(start, safeTotal - 1));
  const boundedEnd = Math.max(0, Math.min(end, safeTotal - 1));
  return {
    start: Math.min(boundedStart, boundedEnd),
    end: Math.max(boundedStart, boundedEnd),
  };
}
