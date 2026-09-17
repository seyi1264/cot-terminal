import type { Stance } from "./types";

export function formatContracts(value: number, digits = 1): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}m`;
  if (abs >= 10_000) return `${sign}${(abs / 1_000).toFixed(digits)}k`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(2)}k`;
  return `${sign}${Math.round(abs).toLocaleString("en-US")}`;
}

export function formatSigned(value: number, digits = 1): string {
  if (value === 0) return "0";
  const mag = formatContracts(Math.abs(value), digits);
  return value > 0 ? `+${mag}` : `−${mag}`;
}

export function formatPct(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function stanceLabel(stance: Stance): string {
  switch (stance) {
    case "strong-bid":
      return "Strong bid";
    case "bid":
      return "Bid";
    case "offer":
      return "Offer";
    case "strong-offer":
      return "Strong offer";
    default:
      return "Balanced";
  }
}

export function stanceTone(stance: Stance): "bid" | "offer" | "flat" {
  if (stance === "strong-bid" || stance === "bid") return "bid";
  if (stance === "strong-offer" || stance === "offer") return "offer";
  return "flat";
}
