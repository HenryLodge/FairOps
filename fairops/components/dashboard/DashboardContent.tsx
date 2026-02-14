'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { GridBounds } from './GridOverlay';
import { useDashboardStats } from './DashboardStatsContext';

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
  };
  vendors: VendorRow[];
  layout: unknown;
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
  const { setStats } = useDashboardStats();
  const [eventsList, setEventsList] = useState<EventListItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    setStats(eventData?.stats ?? null);
    return () => setStats(null);
  }, [eventData?.stats, setStats]);

  const loadDetail = useCallback(async (eventId: string) => {
    setDetailLoading(true);
    setEventData(null);
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
  }, []);

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
      await loadDetail(selectedEventId);
    },
    [selectedEventId, loadDetail]
  );

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
          {/* Venue Map — takes main space */}
          <div
            className="min-h-0 flex-1 overflow-hidden rounded-xl border"
            style={{ minHeight: 320, borderColor: 'var(--color-border)' }}
          >
            {event && (
              <VenueMap
                event={{
                  id: event.id,
                  location: event.location,
                  venue_width: event.venue_width,
                  venue_height: event.venue_height,
                  venue_lat: event.venue_lat,
                  venue_lng: event.venue_lng,
                  venue_bounds: event.venue_bounds,
                }}
                venueWidth={event.venue_width ?? 8}
                venueHeight={event.venue_height ?? 6}
                onSave={handleSaveGrid}
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
                        {v.description ? ` · ${v.description.slice(0, 60)}${v.description.length > 60 ? "…" : ""}` : ""}
                      </p>
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
