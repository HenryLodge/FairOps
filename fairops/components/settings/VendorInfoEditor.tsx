'use client';

import { useState, useEffect, useCallback } from 'react';

const VENDOR_TYPES = ['food', 'game', 'merch', 'ride'] as const;

/** Stored value is always square feet (integer). */
const AREA_UNITS = [
  { value: 'sq_ft', label: 'sq ft' },
  { value: 'sq_m', label: 'm²' },
] as const;
const SQ_M_TO_SQ_FT = 10.7639;

type EventInfo = {
  id: string;
  name: string;
  date: string;
  location: string;
};

type VendorApp = {
  id: string;
  event_id: string;
  booth_name: string;
  vendor_type: string;
  description: string | null;
  space_needed: number;
  power_needed: boolean;
  status: string;
  event?: EventInfo | null;
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function VendorInfoEditor() {
  const [role, setRole] = useState<string | null>(null);
  const [applications, setApplications] = useState<VendorApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, vendorsRes] = await Promise.all([
        fetch('/api/profile'),
        fetch('/api/vendors'),
      ]);
      if (!profileRes.ok) {
        setRole(null);
        setLoading(false);
        return;
      }
      const profileBody = (await profileRes.json()) as { profile: { role: string } | null };
      const profileRole = profileBody.profile?.role ?? null;
      setRole(profileRole);

      if (profileRole !== 'vendor') {
        setLoading(false);
        return;
      }
      if (!vendorsRes.ok) {
        const body = await vendorsRes.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? 'Failed to load applications');
      }
      const vendorsBody = (await vendorsRes.json()) as { vendors: VendorApp[] };
      setApplications(vendorsBody.vendors ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
    );
  }

  if (role !== 'vendor') {
    return null;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-2 text-sm font-medium text-red-700 underline dark:text-red-300"
        >
          Retry
        </button>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        You have no vendor applications yet. Apply to an event from the Vendor Portal.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Edit your application details below. Changes apply to that event application only.
      </p>
      <ul className="space-y-4">
        {applications.map((app) => (
          <VendorAppEditForm
            key={app.id}
            app={app}
            savingId={savingId}
            setSavingId={setSavingId}
            onSaved={load}
          />
        ))}
      </ul>
    </div>
  );
}

function VendorAppEditForm({
  app,
  savingId,
  setSavingId,
  onSaved,
}: {
  app: VendorApp;
  savingId: string | null;
  setSavingId: (id: string | null) => void;
  onSaved: () => void;
}) {
  const eventName = app.event?.name ?? app.events?.name ?? 'Event';
  const eventDate = app.event?.date ?? app.events?.date ?? '';

  const [boothName, setBoothName] = useState(app.booth_name);
  const [vendorType, setVendorType] = useState(app.vendor_type);
  const [description, setDescription] = useState(app.description ?? '');
  const [spaceNeeded, setSpaceNeeded] = useState(String(app.space_needed));
  const [spaceUnit, setSpaceUnit] = useState<'sq_ft' | 'sq_m'>('sq_ft');
  const [powerNeeded, setPowerNeeded] = useState(app.power_needed);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setBoothName(app.booth_name);
    setVendorType(app.vendor_type);
    setDescription(app.description ?? '');
    setSpaceNeeded(String(app.space_needed));
    setSpaceUnit('sq_ft');
    setPowerNeeded(app.power_needed);
  }, [app.id, app.booth_name, app.vendor_type, app.description, app.space_needed, app.power_needed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSavingId(app.id);
    try {
      const raw = parseFloat(spaceNeeded);
      if (Number.isNaN(raw) || raw <= 0) {
        setSaveError('Area must be a positive number');
        return;
      }
      const spaceSqFt =
        spaceUnit === 'sq_m'
          ? Math.round(raw * SQ_M_TO_SQ_FT)
          : Math.round(raw);
      if (spaceSqFt < 1) {
        setSaveError('Area is too small (min 1 sq ft)');
        return;
      }
      const res = await fetch(`/api/vendors/${app.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booth_name: boothName.trim(),
          vendor_type: vendorType,
          description: description.trim() || null,
          space_needed: spaceSqFt,
          power_needed: powerNeeded,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSaveError((body as { error?: string }).error ?? 'Save failed');
        return;
      }
      onSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingId(null);
    }
  };

  const saving = savingId === app.id;

  return (
    <li className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
      <p className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {eventName}
        {eventDate && (
          <span className="ml-2 font-normal text-zinc-500 dark:text-zinc-400">
            · {formatDate(eventDate)}
          </span>
        )}
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor={`booth-${app.id}`} className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Booth name
          </label>
          <input
            id={`booth-${app.id}`}
            type="text"
            value={boothName}
            onChange={(e) => setBoothName(e.target.value)}
            required
            className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-400"
          />
        </div>
        <div>
          <label htmlFor={`type-${app.id}`} className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Type
          </label>
          <select
            id={`type-${app.id}`}
            value={vendorType}
            onChange={(e) => setVendorType(e.target.value)}
            className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-400"
          >
            {VENDOR_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`desc-${app.id}`} className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Description (optional)
          </label>
          <textarea
            id={`desc-${app.id}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-400"
          />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label htmlFor={`space-${app.id}`} className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Area needed
            </label>
            <div className="flex items-center gap-2">
              <input
                id={`space-${app.id}`}
                type="number"
                min={spaceUnit === 'sq_m' ? 0.1 : 1}
                step={spaceUnit === 'sq_m' ? 0.1 : 1}
                value={spaceNeeded}
                onChange={(e) => setSpaceNeeded(e.target.value)}
                placeholder={spaceUnit === 'sq_m' ? 'e.g. 14' : 'e.g. 150'}
                className="w-24 rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-400"
              />
              <select
                id={`space-unit-${app.id}`}
                value={spaceUnit}
                onChange={(e) => setSpaceUnit(e.target.value as 'sq_ft' | 'sq_m')}
                aria-label="Area unit"
                className="rounded border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                {AREA_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Area in sq ft or m² (converted to sq ft when saving).
            </p>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input
              id={`power-${app.id}`}
              type="checkbox"
              checked={powerNeeded}
              onChange={(e) => setPowerNeeded(e.target.checked)}
              className="h-4 w-4 rounded border-2 border-zinc-400 bg-white text-zinc-900 focus:ring-2 focus:ring-amber-500 dark:border-zinc-500 dark:bg-zinc-800 dark:text-amber-500"
            />
            <label htmlFor={`power-${app.id}`} className="text-sm text-zinc-700 dark:text-zinc-300">
              Power needed
            </label>
          </div>
        </div>
        {saveError && (
          <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </li>
  );
}
