'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowUp, Paintbrush, Settings, Plus, Activity, Circle, Car, Home, UtensilsCrossed, Camera, Info } from 'lucide-react';
import Link from 'next/link';
import { useDashboardStats, formatRevenue, type Attractions } from './DashboardStatsContext';

const COUNTER_ITEMS = [
  { id: 'roller_coaster', label: 'Roller Coaster', icon: Activity },
  { id: 'ferris_wheel', label: 'Ferris Wheel', icon: Circle },
  { id: 'bumper_car', label: 'Bumper Car', icon: Car },
  { id: 'fun_house', label: 'Fun House', icon: Home },
  { id: 'food_stand', label: 'Food Stand', icon: UtensilsCrossed },
  { id: 'photo_booth', label: 'Photo Booth', icon: Camera },
  { id: 'info_booth', label: 'Info Booth', icon: Info },
] as const;

const DEFAULT_COUNTS: Attractions = {
  roller_coaster: 0,
  ferris_wheel: 0,
  bumper_car: 0,
  fun_house: 0,
  food_stand: 0,
  photo_booth: 0,
  info_booth: 0,
};

const SAVE_DEBOUNCE_MS = 800;

export function Sidebar() {
  const { stats, attractions, setAttractions, saveAttractions } = useDashboardStats();

  /* Local counter state — initialised from context (DB) whenever attractions change */
  const [counts, setCounts] = useState<Attractions>(DEFAULT_COUNTS);
  const initialised = useRef(false);

  useEffect(() => {
    if (Object.keys(attractions).length > 0 || !initialised.current) {
      setCounts({ ...DEFAULT_COUNTS, ...attractions });
      initialised.current = true;
    }
  }, [attractions]);

  /* Debounced save: fires SAVE_DEBOUNCE_MS after last change */
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSave = useCallback(
    (next: Attractions) => {
      /* Push into shared context immediately so other components see the change */
      setAttractions(next);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        saveAttractions?.(next);
      }, SAVE_DEBOUNCE_MS);
    },
    [setAttractions, saveAttractions]
  );

  /* Clean up timer on unmount */
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const adjust = (id: string, delta: number) => {
    const next = { ...counts, [id]: Math.max(0, (counts[id] ?? 0) + delta) };
    setCounts(next);
    debouncedSave(next);
  };

  return (
    <aside
      className="dashboard-sidebar flex h-full w-72 flex-col shrink-0"
      style={{ background: 'var(--color-surface)', color: 'var(--color-text-secondary)' }}
    >
      <div className="border-b p-3" style={{ borderColor: 'var(--color-border)' }}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
            drag & drop
          </p>
          <Link
            href="/settings"
            className="flex h-9 w-9 items-center justify-center rounded-md hover:opacity-80"
            style={{ background: 'var(--color-bg-elevated)' }}
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex gap-2">
          <Link
            href="#"
            className="flex h-9 w-9 items-center justify-center rounded-md hover:opacity-80"
            style={{ background: 'var(--color-bg-elevated)' }}
            aria-label="Layout"
          >
            <ArrowUp className="h-4 w-4" />
          </Link>
          <Link
            href="#"
            className="flex h-9 w-9 items-center justify-center rounded-md hover:opacity-80"
            style={{ background: 'var(--color-bg-elevated)' }}
            aria-label="Edit"
          >
            <Paintbrush className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="border-b p-3" style={{ borderColor: 'var(--color-border)' }}>
        <Link
          href="/dashboard/new"
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:opacity-90"
          style={{ color: 'var(--color-accent)' }}
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>New event</span>
        </Link>
      </div>

      <div className="flex-1 space-y-1 border-b p-3" style={{ borderColor: 'var(--color-border)' }}>
        {COUNTER_ITEMS.map(({ id, label, icon: Icon }) => (
          <div
            key={id}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:opacity-90"
            style={{ color: 'var(--color-text)' }}
          >
            <Icon className="h-4 w-4 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
            <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => adjust(id, -1)}
                className="flex h-6 w-6 items-center justify-center rounded hover:opacity-80"
                style={{ color: 'var(--color-accent)' }}
                aria-label={`Decrease ${label}`}
              >
                −
              </button>
              <span className="min-w-[1.5rem] text-center text-sm tabular-nums">
                {counts[id] ?? 0}
              </span>
              <button
                type="button"
                onClick={() => adjust(id, 1)}
                className="flex h-6 w-6 items-center justify-center rounded hover:opacity-80"
                style={{ color: 'var(--color-accent)' }}
                aria-label={`Increase ${label}`}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      {stats && (
        <div className="border-b p-3" style={{ borderColor: 'var(--color-border)' }}>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border p-2" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-elevated)' }}>
              <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                Vendors
              </p>
              <p className="mt-0.5 truncate text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
                {stats.approved} / {stats.pending}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{stats.totalVendors} total</p>
            </div>
            <div className="rounded border p-2" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-elevated)' }}>
              <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                Revenue
              </p>
              <p className="mt-0.5 truncate text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
                {formatRevenue(stats.totalRevenue)}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{stats.paid} paid</p>
            </div>
            <div className="rounded border p-2" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-elevated)' }}>
              <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                Layout
              </p>
              <p className="mt-0.5 truncate text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
                {stats.layoutStatus === 'generated' ? 'Generated' : 'Not generated'}
              </p>
            </div>
            <div className="rounded border p-2" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-elevated)' }}>
              <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                Safety
              </p>
              <p className="mt-0.5 truncate text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
                {stats.safetyFlagsCount === 0 ? 'No flags' : `${stats.safetyFlagsCount} flag${stats.safetyFlagsCount === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="p-3">
        <button
          type="button"
          onClick={() => console.log('AI Button clicked')}
          className="w-full rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90"
          style={{ background: 'var(--color-accent)', color: 'var(--color-bg)' }}
        >
          Optimize with AI
        </button>
      </div>
    </aside>
  );
}
