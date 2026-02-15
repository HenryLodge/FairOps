'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useWallet } from '@solana/wallet-adapter-react';
import type { GridBounds } from './GridOverlay';
import type { DrawnShape } from './VenueMap';
import { useDashboardStats, type Attractions } from './DashboardStatsContext';
import LayoutDisplay, { type LayoutData } from './LayoutDisplay';

const VenueMap = dynamic(() => import('./VenueMap'), {
  ssr: false,
  loading: () => (
    <div
      className="flex min-h-[400px] items-center justify-center rounded-xl border"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div
        className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
        style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-accent)' }}
      />
    </div>
  ),
});

type VendorRow = {
  id: string;
  booth_name: string;
  vendor_type: string;
  status: string;
  description: string | null;
  space_needed?: number;
  power_needed?: boolean;
  booth_fee?: number | null;
  payment_status?: string | null;
  created_at?: string | null;
};

type EventData = {
  event: {
    id: string;
    name: string;
    date: string;
    location: string;
    expected_attendance: number | null;
    venue_width: number | null;
    venue_height: number | null;
    description: string | null;
    venue_lat: number | null;
    venue_lng: number | null;
    venue_bounds: GridBounds | null;
    venue_metrics?: { widthMeters: number; heightMeters: number; areaM2: number } | null;
    drawn_shapes?: DrawnShape[] | null;
    attractions: Attractions | null;
    organizer_wallet?: string | null;
  };
  vendors: VendorRow[];
  layout: {
    id: string;
    layout_data: { image?: string; mimeType?: string; safetyNotes?: string[] };
    reasoning: string | null;
    is_active: boolean;
  } | null;
  stats: {
    totalVendors: number;
    approved: number;
    pending: number;
    rejected: number;
    paid: number;
    totalRevenue: number;
    layoutStatus: 'none' | 'generated';
    safetyFlagsCount: number;
  };
};

function PaymentStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; color: string; label: string }> = {
    escrowed: { bg: 'rgba(59, 130, 246, 0.2)', color: '#60A5FA', label: 'Escrowed' },
    confirmed: { bg: 'rgba(16, 185, 129, 0.2)', color: '#34D399', label: 'Confirmed' },
    refunded: { bg: 'rgba(168, 85, 247, 0.2)', color: '#C084FC', label: 'Refunded' },
    paid: { bg: 'rgba(16, 185, 129, 0.2)', color: '#34D399', label: 'Paid' },
    unpaid: { bg: 'rgba(107, 114, 128, 0.2)', color: '#9CA3AF', label: 'Unpaid' },
  };
  const c = config[status] ?? config.unpaid;
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: c.bg, color: c.color }}
    >
      {c.label}
    </span>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

type EventListItem = { id: string; name: string; date: string };

export function DashboardContent() {
  const {
    setStats,
    setEventId: setCtxEventId,
    setAttractions: setCtxAttractions,
    registerSaveAttractions,
  } = useDashboardStats();
  const { publicKey, connected } = useWallet();
  const [eventsList, setEventsList] = useState<EventListItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);

  /* AI layout state */
  const [viewMode, setViewMode] = useState<'map' | 'layout'>('map');
  const [optimizing, setOptimizing] = useState(false);
  const [refining, setRefining] = useState(false);

  /* Keep a ref to the latest selectedEventId so the save callback is always fresh */
  const eventIdRef = useRef(selectedEventId);
  eventIdRef.current = selectedEventId;

  /* ---- Auto-save organizer wallet to the selected event ---- */
  const savedWalletRef = useRef<string | null>(null);
  useEffect(() => {
    const eventId = eventData?.event.id;
    if (!eventId || !connected || !publicKey) return;

    const walletAddr = publicKey.toBase58();
    // Skip if the event already has this wallet, or we just saved it
    if (eventData.event.organizer_wallet === walletAddr) return;
    if (savedWalletRef.current === `${eventId}:${walletAddr}`) return;
    savedWalletRef.current = `${eventId}:${walletAddr}`;

    fetch(`/api/events/${eventId}`, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizer_wallet: walletAddr }),
    })
      .then((res) => {
        if (!res.ok) console.error('[wallet] Failed to save organizer_wallet:', res.status);
        else console.log('[wallet] Saved organizer_wallet to event', eventId);
      })
      .catch((err) => console.error('[wallet] Error saving organizer_wallet:', err));
  }, [eventData?.event.id, eventData?.event.organizer_wallet, connected, publicKey]);

  useEffect(() => {
    setStats(eventData?.stats ?? null);
    return () => setStats(null);
  }, [eventData?.stats, setStats]);

  /* Push eventId + attractions into the shared context whenever event data changes */
  useEffect(() => {
    setCtxEventId(eventData?.event.id ?? null);
    setCtxAttractions(eventData?.event.attractions ?? {});
  }, [eventData, setCtxEventId, setCtxAttractions]);

  /* Provide a save function the Sidebar can call to persist attractions */
  useEffect(() => {
    const saveFn = async (a: Attractions) => {
      const eid = eventIdRef.current;
      if (!eid) {
        console.warn('[attractions] No eventId, skipping save');
        return;
      }
      try {
        console.log('[attractions] Saving to event', eid, a);
        const res = await fetch(`/api/events/${eid}`, {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attractions: a }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          console.error('[attractions] Save failed:', res.status, body);
        } else {
          console.log('[attractions] Saved successfully');
        }
      } catch (err) {
        console.error('[attractions] Save error:', err);
      }
    };
    registerSaveAttractions(saveFn);
    return () => registerSaveAttractions(null);
  }, [registerSaveAttractions]);

  const loadDetail = useCallback(
    async (eventId: string, options?: { clearData?: boolean }) => {
      const clearData = options?.clearData !== false;
      setDetailLoading(true);
      if (clearData) setEventData(null);
      try {
        const res = await fetch(`/api/events/${eventId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error || `Failed to load event (${res.status})`
          );
        }
        const data = (await res.json()) as EventData;
        setEventData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setDetailLoading(false);
      }
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEmpty(false);
    setEventData(null);
    setEventsList([]);
    setSelectedEventId(null);

    try {
      const listRes = await fetch('/api/events');
      if (!listRes.ok) {
        const body = await listRes.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error || `Failed to load events (${listRes.status})`
        );
      }
      const listBody = (await listRes.json()) as {
        events: { id: string; name: string; date: string }[];
      };
      const events = listBody.events ?? [];
      if (events.length === 0) {
        setEmpty(true);
        setLoading(false);
        return;
      }

      setEventsList(events);
      const firstId = events[0].id;
      setSelectedEventId(firstId);
      await loadDetail(firstId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [loadDetail]);

  const handleEventChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      if (!id) return;
      setSelectedEventId(id);
      loadDetail(id);
    },
    [loadDetail]
  );

  const handleApprove = useCallback(
    async (vendorId: string) => {
      if (!selectedEventId) return;
      try {
        const res = await fetch(`/api/vendors/${vendorId}/approve`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ boothFee: 100_000_000 }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error ?? 'Failed to approve');
        }
        await loadDetail(selectedEventId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to approve vendor');
      }
    },
    [selectedEventId, loadDetail]
  );

  const handleReject = useCallback(
    async (vendorId: string) => {
      if (!selectedEventId) return;
      try {
        const res = await fetch(`/api/vendors/${vendorId}/reject`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error ?? 'Failed to reject');
        }
        await loadDetail(selectedEventId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reject vendor');
      }
    },
    [selectedEventId, loadDetail]
  );

  const handleSaveGrid = useCallback(
    async (data: {
      venue_width: number;
      venue_height: number;
      venue_lat: number;
      venue_lng: number;
      venue_bounds: GridBounds;
      drawn_shapes?: unknown[];
      venue_metrics?: { widthMeters: number; heightMeters: number; areaM2: number } | null;
    }) => {
      if (!selectedEventId) return;
      const res = await fetch(`/api/events/${selectedEventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? 'Failed to save grid'
        );
      }
      await loadDetail(selectedEventId, { clearData: false });
    },
    [selectedEventId, loadDetail]
  );

  /* ---- AI optimize handler ---- */
  const handleOptimize = useCallback(async () => {
    const eid = eventIdRef.current;
    if (!eid || optimizing) return;
    setOptimizing(true);
    setViewMode('layout');
    try {
      const res = await fetch('/api/copilot/optimize', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: eid }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Optimize failed (${res.status})`
        );
      }
      // Reload event detail to pick up the new layout from DB
      await loadDetail(eid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Optimize failed');
    } finally {
      setOptimizing(false);
    }
  }, [optimizing, loadDetail]);

  /* ---- AI refine handler ---- */
  const handleRefine = useCallback(
    async (feedback: string) => {
      const eid = eventIdRef.current;
      if (!eid || refining) return;
      setRefining(true);
      try {
        const res = await fetch('/api/copilot/refine', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId: eid, feedback }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ?? `Refine failed (${res.status})`
          );
        }
        await loadDetail(eid);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Refine failed');
      } finally {
        setRefining(false);
      }
    },
    [refining, loadDetail],
  );

  /* Listen for "optimize-layout" custom DOM event dispatched by Sidebar */
  useEffect(() => {
    const handler = () => handleOptimize();
    window.addEventListener('optimize-layout', handler);
    return () => window.removeEventListener('optimize-layout', handler);
  }, [handleOptimize]);

  /* Derive LayoutData from eventData for the LayoutDisplay component */
  const currentLayout: LayoutData | null = (() => {
    const raw = eventData?.layout;
    if (!raw) return null;
    return {
      id: raw.id,
      image: raw.layout_data?.image,
      mimeType: raw.layout_data?.mimeType,
      reasoning: raw.reasoning,
      safetyNotes: raw.layout_data?.safetyNotes,
    };
  })();

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex h-full flex-col gap-4 p-4">
        <div
          className="h-8 w-64 animate-pulse rounded"
          style={{ background: 'var(--color-bg-elevated)' }}
        />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg"
              style={{ background: 'var(--color-bg-elevated)' }}
            />
          ))}
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-accent)' }}
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
        <p className="text-center" style={{ color: 'var(--color-text-secondary)' }}>{error}</p>
        <button
          type="button"
          onClick={load}
          className="rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90"
          style={{ background: 'var(--color-accent)', color: 'var(--color-bg)' }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
        <p className="text-center" style={{ color: 'var(--color-text-secondary)' }}>
          No event yet.
        </p>
        <Link
          href="/dashboard/new"
          className="rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90"
          style={{ background: 'var(--color-accent)', color: 'var(--color-bg)' }}
        >
          Create event
        </Link>
      </div>
    );
  }

  if (!eventData && !detailLoading) {
    return null;
  }

  const event = eventData?.event;

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <select
            value={selectedEventId ?? ''}
            onChange={handleEventChange}
            className="w-full max-w-md rounded-lg border px-3 py-2 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
            style={{
              borderColor: 'var(--color-accent)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
            }}
            aria-label="Select event"
          >
            {eventsList.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {formatDate(e.date)}
              </option>
            ))}
          </select>
          {event && (
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {formatDate(event.date)}
              {event.location ? ` · ${event.location}` : ''}
              {event.expected_attendance != null
                ? ` · ${event.expected_attendance.toLocaleString()} expected`
                : ''}
            </p>
          )}
        </div>
        <Link
          href="/dashboard/new"
          className="shrink-0 rounded-lg border px-4 py-2 text-sm font-medium hover:opacity-90"
          style={{
            borderColor: 'var(--color-accent)',
            background: 'var(--color-surface)',
            color: 'var(--color-accent)',
          }}
        >
          New event
        </Link>
      </header>

      {detailLoading && !eventData ? (
        <div className="flex flex-1 items-center justify-center">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-accent)' }}
          />
        </div>
      ) : eventData ? (
        <>
          {/* ---- Tab bar: Venue Map / AI Layout ---- */}
          <div
            className="flex shrink-0 gap-1 rounded-lg p-1"
            style={{ background: 'var(--color-bg-elevated)' }}
          >
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
              style={
                viewMode === 'map'
                  ? { background: 'var(--color-accent)', color: 'var(--color-bg)' }
                  : { color: 'var(--color-text-secondary)' }
              }
            >
              Venue Map
            </button>
            <button
              type="button"
              onClick={() => setViewMode('layout')}
              className="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
              style={
                viewMode === 'layout'
                  ? { background: 'var(--color-accent)', color: 'var(--color-bg)' }
                  : { color: 'var(--color-text-secondary)' }
              }
            >
              AI Layout
              {currentLayout && (
                <span
                  className="ml-1.5 inline-block h-2 w-2 rounded-full"
                  style={{ background: '#34D399' }}
                  title="Layout generated"
                />
              )}
            </button>
          </div>

          {/* ---- Main content area ---- */}
          <div
            className="min-h-0 flex-1 overflow-hidden rounded-xl border"
            style={{ minHeight: 320, borderColor: 'var(--color-border)' }}
          >
            {viewMode === 'map' ? (
              event && (
                <VenueMap
                  event={{
                    id: event.id,
                    location: event.location,
                    venue_width: event.venue_width,
                    venue_height: event.venue_height,
                    venue_lat: event.venue_lat,
                    venue_lng: event.venue_lng,
                    venue_bounds: event.venue_bounds,
                    venue_metrics: event.venue_metrics ?? null,
                    drawn_shapes: event.drawn_shapes ?? null,
                  }}
                  venueWidth={event.venue_width ?? 8}
                  venueHeight={event.venue_height ?? 6}
                  onSave={handleSaveGrid}
                />
              )
            ) : (
              <LayoutDisplay
                layout={currentLayout}
                onRefine={handleRefine}
                isOptimizing={optimizing}
                isRefining={refining}
              />
            )}
          </div>

          {/* Vendor applications — under the map */}
          <section
            className="shrink-0 rounded-lg border p-4"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
          >
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
              Vendor applications
            </h2>
            {eventData.vendors.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                No applications yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {eventData.vendors.map((v) => (
                  <li
                    key={v.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border py-2 pl-3 pr-2"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                        {v.booth_name}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {v.vendor_type}
                        {typeof v.space_needed === 'number' ? ` · ${v.space_needed} sq ft` : ''}
                        {v.power_needed ? ' · Power' : ''}
                      </p>
                      {v.description ? (
                        <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                          {v.description.length > 80 ? `${v.description.slice(0, 80)}…` : v.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                        style={
                          v.status === 'approved'
                            ? { background: 'rgba(16, 185, 129, 0.2)', color: '#34D399' }
                            : v.status === 'rejected'
                              ? { background: 'rgba(239, 68, 68, 0.2)', color: '#F87171' }
                              : { background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }
                        }
                      >
                        {v.status}
                      </span>
                      <PaymentStatusBadge status={v.payment_status ?? 'unpaid'} />
                      {v.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleApprove(v.id)}
                            className="rounded px-2 py-1 text-xs font-medium hover:opacity-90"
                            style={{ background: 'var(--color-accent)', color: 'var(--color-bg)' }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(v.id)}
                            className="rounded px-2 py-1 text-xs font-medium hover:opacity-90"
                            style={{ background: 'rgba(239, 68, 68, 0.9)', color: '#fff' }}
                          >
                            Deny
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
