export type ZoneDirection = "demand" | "supply";

export type ZonePriceInput = {
  direction: ZoneDirection;
  lowerPrice: number;
  upperPrice: number;
  invalidationPrice: number;
};

export type ZonePriceValidationError = {
  field: "upperPrice" | "invalidationPrice";
  message: string;
};

export function validateZonePrices(value: ZonePriceInput): ZonePriceValidationError | null {
  if (value.upperPrice < value.lowerPrice) {
    return { field: "upperPrice", message: "Upper price must be at or above lower price." };
  }
  if (value.direction === "demand" && value.invalidationPrice >= value.lowerPrice) {
    return { field: "invalidationPrice", message: "Demand invalidation must be below the zone." };
  }
  if (value.direction === "supply" && value.invalidationPrice <= value.upperPrice) {
    return { field: "invalidationPrice", message: "Supply invalidation must be above the zone." };
  }
  return null;
}