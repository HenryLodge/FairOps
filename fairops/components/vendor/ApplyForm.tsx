"use client";

import { useState } from "react";

const VENDOR_TYPES = ["food", "game", "merch", "ride"] as const;

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
  const [spaceNeeded, setSpaceNeeded] = useState(1);
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
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          boothName: boothName.trim(),
          vendorType,
          description: description.trim() || undefined,
          spaceNeeded: spaceNeeded >= 1 ? spaceNeeded : 1,
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

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Apply to: {eventName}
      </h3>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div>
          <label
            htmlFor="boothName"
            className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Booth name *
          </label>
          <input
            id="boothName"
            type="text"
            value={boothName}
            onChange={(e) => setBoothName(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            placeholder="e.g. Taco Truck"
            required
          />
        </div>
        <div>
          <label
            htmlFor="vendorType"
            className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Vendor type *
          </label>
          <select
            id="vendorType"
            value={vendorType}
            onChange={(e) =>
              setVendorType(e.target.value as (typeof VENDOR_TYPES)[number])
            }
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {VENDOR_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="description"
            className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Description (optional)
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            placeholder="Short description of your booth"
          />
        </div>
        <div className="flex gap-4">
          <div>
            <label
              htmlFor="spaceNeeded"
              className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              Space needed (optional)
            </label>
            <input
              id="spaceNeeded"
              type="number"
              min={1}
              value={spaceNeeded}
              onChange={(e) =>
                setSpaceNeeded(Math.max(1, parseInt(e.target.value, 10) || 1))
              }
              className="mt-1 w-20 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div className="flex items-end gap-2">
            <input
              id="powerNeeded"
              type="checkbox"
              checked={powerNeeded}
              onChange={(e) => setPowerNeeded(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
            />
            <label
              htmlFor="powerNeeded"
              className="text-sm text-zinc-600 dark:text-zinc-400"
            >
              Power needed
            </label>
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading ? "Submitting…" : "Submit application"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
