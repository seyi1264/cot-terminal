export type PriceZoneCandidate = {
  instrumentCode: string;
  direction: "demand" | "supply";
  lowerPrice: number;
  upperPrice: number;
  quality: string;
  active: boolean;
};

export function chooseActiveZone<Zone extends PriceZoneCandidate>(
  zones: Zone[],
  instrumentCode: string,
  price: number,
  supportsDirection: (direction: Zone["direction"]) => boolean,
): Zone | null {
  const active = zones.filter((zone) =>
    zone.instrumentCode === instrumentCode && zone.active && zone.quality !== "removed",
  );
  const containing = active.filter((zone) => price >= zone.lowerPrice && price <= zone.upperPrice);
  return containing.find((zone) => supportsDirection(zone.direction)) ?? containing[0] ?? active[0] ?? null;
}