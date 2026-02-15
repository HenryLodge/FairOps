"use client";

import { useState } from "react";

const VENDOR_TYPES = ["food", "game", "merch", "ride"] as const;

const AREA_UNITS = [
  { value: "sq_ft", label: "sq ft" },
  { value: "sq_m", label: "m²" },
] as const;
const SQ_M_TO_SQ_FT = 10.7639;

type ApplyFormProps = {
  eventId: string;
  eventName: string;
  onSuccess: () => void;
  onCancel: () => void;
};

export function ApplyForm({
  eventId,
  eventName,
  onSuccess,
  onCancel,
}: ApplyFormProps) {
  const [boothName, setBoothName] = useState("");
  const [vendorType, setVendorType] = useState<(typeof VENDOR_TYPES)[number]>(
    "food"
  );
  const [description, setDescription] = useState("");
  const [areaValue, setAreaValue] = useState("150");
  const [areaUnit, setAreaUnit] = useState<"sq_ft" | "sq_m">("sq_ft");
  const [powerNeeded, setPowerNeeded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!boothName.trim()) {
      setError("Booth name is required.");
      return;
    }
    setLoading(true);
    try {
      const raw = parseFloat(areaValue);
      const spaceSqFt =
        Number.isNaN(raw) || raw <= 0
          ? 1
          : areaUnit === "sq_m"
            ? Math.max(1, Math.round(raw * SQ_M_TO_SQ_FT))
            : Math.max(1, Math.round(raw));
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          boothName: boothName.trim(),
          vendorType,
          description: description.trim() || undefined,
          spaceNeeded: spaceSqFt,
          powerNeeded,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Failed to apply.");
        return;
      }
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-[var(--color-bg-elevated)] border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--color-border)", background: "var(--color-bg-elevated)" }}
    >
      <h3 className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
        Apply to: {eventName}
      </h3>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div>
          <label htmlFor="boothName" className="block text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
            Booth name *
          </label>
          <input
            id="boothName"
            type="text"
            value={boothName}
            onChange={(e) => setBoothName(e.target.value)}
            className={inputClass}
            placeholder="e.g. Taco Truck"
            required
          />
        </div>
        <div>
          <label htmlFor="vendorType" className="block text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
            Vendor type *
          </label>
          <select
            id="vendorType"
            value={vendorType}
            onChange={(e) =>
              setVendorType(e.target.value as (typeof VENDOR_TYPES)[number])
            }
            className={inputClass}
          >
            {VENDOR_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="description" className="block text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
            Description (optional)
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="Short description of your booth"
          />
        </div>
        <div className="flex gap-4">
          <div>
            <label htmlFor="areaNeeded" className="block text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
              Area needed (optional)
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="areaNeeded"
                type="number"
                min={areaUnit === "sq_m" ? 0.1 : 1}
                step={areaUnit === "sq_m" ? 0.1 : 1}
                value={areaValue}
                onChange={(e) => setAreaValue(e.target.value)}
                placeholder={areaUnit === "sq_m" ? "e.g. 14" : "e.g. 150"}
                className={inputClass.replace("w-full", "w-24")}
              />
              <select
                id="areaUnit"
                value={areaUnit}
                onChange={(e) => setAreaUnit(e.target.value as "sq_ft" | "sq_m")}
                aria-label="Area unit"
                className={inputClass.replace("w-full", "w-auto min-w-[5rem]")}
              >
                {AREA_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <input
              id="powerNeeded"
              type="checkbox"
              checked={powerNeeded}
              onChange={(e) => setPowerNeeded(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-accent)]"
            />
            <label htmlFor="powerNeeded" className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Power needed
            </label>
          </div>
        </div>
        {error && <p className="text-sm text-[#F87171]">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-bg)] hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Submitting…" : "Submit application"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-bg-elevated)]"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
