import { createServerFn } from "@tanstack/react-start";

export type MacroEvent = {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast?: string;
  previous?: string;
};

export const getMacroCalendar = createServerFn({ method: "GET" }).handler(async () => {
  const response = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
    headers: { Accept: "application/json", "User-Agent": "OakLedger/1.0" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Calendar source ${response.status}`);
  const json = (await response.json()) as unknown;
  if (!Array.isArray(json)) throw new Error("Calendar payload unavailable");
  return json.filter(isMacroEvent).slice(0, 80);
});

function isMacroEvent(value: unknown): value is MacroEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<MacroEvent>;
  return typeof event.title === "string" && typeof event.country === "string" && typeof event.date === "string" && typeof event.impact === "string";
}