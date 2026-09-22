import { useEffect, useState, type ReactNode } from "react";
import { createThesisZone, listThesisZones, removeThesisZone, updateThesisZone, type ThesisZone } from "@/lib/cot/zones.functions";
import type { InstrumentReport } from "@/lib/cot/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Direction = ThesisZone["direction"];
type Timeframe = ThesisZone["timeframe"];
type Quality = ThesisZone["quality"];

type FormState = {
  direction: Direction;
  timeframe: Timeframe;
  lowerPrice: string;
  upperPrice: string;
  invalidationPrice: string;
  quality: Exclude<Quality, "removed">;
};

const EMPTY_FORM: FormState = {
  direction: "demand",
  timeframe: "daily",
  lowerPrice: "",
  upperPrice: "",
  invalidationPrice: "",
  quality: "fresh",
};

export function ZoneEditor({ report }: { report: InstrumentReport }) {
  const [zones, setZones] = useState<ThesisZone[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    void listThesisZones()
      .then((items) => active && setZones(items.filter((zone) => zone.instrumentCode === report.code)))
      .catch((error: unknown) => active && setMessage(zoneErrorMessage(error, "load")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [report.code]);

  function updateForm<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function editZone(zone: ThesisZone) {
    setEditingId(zone.id);
    setForm({
      direction: zone.direction,
      timeframe: zone.timeframe,
      lowerPrice: String(zone.lowerPrice),
      upperPrice: String(zone.upperPrice),
      invalidationPrice: String(zone.invalidationPrice),
      quality: zone.quality === "tested" ? "tested" : "fresh",
    });
    setMessage("");
  }

  function reset() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setMessage("");
  }

  async function save() {
    const lowerPrice = Number(form.lowerPrice);
    const upperPrice = Number(form.upperPrice);
    const invalidationPrice = Number(form.invalidationPrice);
    if (![lowerPrice, upperPrice, invalidationPrice].every(Number.isFinite) || upperPrice < lowerPrice) {
      setMessage("Enter numeric prices with upper price at or above lower price.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const data = { instrumentCode: report.code, direction: form.direction, timeframe: form.timeframe, lowerPrice, upperPrice, invalidationPrice, quality: form.quality, active: true } as const;
      const saved = editingId
        ? await updateThesisZone({ data: { id: editingId, ...data } })
        : await createThesisZone({ data });
      setZones((current) => editingId ? current.map((zone) => zone.id === saved.id ? saved : zone) : [saved, ...current]);
      reset();
      setMessage("Zone saved. Thursday alerts are armed.");
    } catch (error) {
      setMessage(zoneErrorMessage(error, "save"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(zone: ThesisZone) {
    try {
      await removeThesisZone({ data: { id: zone.id } });
      setZones((current) => current.filter((item) => item.id !== zone.id));
      if (editingId === zone.id) reset();
    } catch {
      setMessage("The zone could not be removed.");
    }
  }

  return (
    <section className="rounded-lg border border-border bg-bg p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-accent">Confirmed price zone</p>
          <h3 className="mt-1 font-display text-lg text-fg">Mark the area you want watched</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted">Numeric boundaries are trader-confirmed. Thursday polling will alert once when price enters the zone.</p>
        </div>
        {loading ? <span className="text-xs text-subtle">Loading</span> : null}
      </div>

      {zones.length ? <div className="mt-4 space-y-2"><p className="text-[11px] uppercase tracking-[0.12em] text-subtle">{zones.length} saved zone{zones.length === 1 ? "" : "s"} for this instrument · no app limit</p>{zones.map((zone) => <div key={zone.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg-elevated p-3"><div><p className="text-xs font-medium uppercase tracking-[0.1em] text-fg">{zone.direction} · {zone.timeframe} · {zone.quality}</p><p className="mt-1 font-mono text-xs tabular text-muted">{zone.lowerPrice} – {zone.upperPrice} · invalidation {zone.invalidationPrice}</p></div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => editZone(zone)} className="text-xs text-accent hover:text-fg">Edit</button><button type="button" onClick={() => void remove(zone)} className="text-xs text-offer hover:text-fg">Remove</button></div></div>)}</div> : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Field label="Direction"><select value={form.direction} onChange={(event) => updateForm("direction", event.target.value as Direction)} className="input"><option value="demand">Demand</option><option value="supply">Supply</option></select></Field>
        <Field label="Timeframe"><select value={form.timeframe} onChange={(event) => updateForm("timeframe", event.target.value as Timeframe)} className="input">{["monthly", "daily", "weekly", "4hr", "1hr", "6M"].map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>
        <Field label="Lower price"><input className="input" type="number" step="any" value={form.lowerPrice} onChange={(event) => updateForm("lowerPrice", event.target.value)} placeholder="Zone floor" /></Field>
        <Field label="Upper price"><input className="input" type="number" step="any" value={form.upperPrice} onChange={(event) => updateForm("upperPrice", event.target.value)} placeholder="Zone ceiling" /></Field>
        <Field label="Invalidation price"><input className="input" type="number" step="any" value={form.invalidationPrice} onChange={(event) => updateForm("invalidationPrice", event.target.value)} placeholder="Thesis invalidation" /></Field>
        <Field label="Quality"><select value={form.quality} onChange={(event) => updateForm("quality", event.target.value as Exclude<Quality, "removed">)} className="input"><option value="fresh">Fresh</option><option value="tested">Tested</option></select></Field>
      </div>
      <div className="mt-3 flex items-center gap-2"><Button variant="quiet" size="sm" onClick={() => void save()} disabled={saving}>{saving ? "Saving..." : editingId ? "Update zone" : "Save zone + alert"}</Button>{editingId ? <button type="button" onClick={reset} className="text-xs text-muted hover:text-fg">Cancel</button> : null}</div>
      {message ? <p className={cn("mt-2 text-xs", message.includes("saved") ? "text-bid" : "text-muted")}>{message}</p> : null}
    </section>
  );
}

function zoneErrorMessage(error: unknown, operation: "load" | "save") {
  const message = error instanceof Error ? error.message : "";
  if (message === "Unauthorized") return "Sign in before saving zones.";
  if (message.includes("DATABASE_URL") || message.includes("database")) {
    return "The account database is not configured or reachable.";
  }
  return operation === "load"
    ? "Zone storage is unavailable until the account database is ready."
    : "The zone could not be saved. Check the account database connection.";
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="text-xs text-muted">{label}{children}</label>;
}
