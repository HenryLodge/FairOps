'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { GridBounds } from './GridOverlay';

const VenueMap = dynamic(() => import('./VenueMap'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
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

const LAMPORTS_PER_SOL = 1_000_000_000;

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

function formatRevenue(lamports: number): string {
  const sol = lamports / LAMPORTS_PER_SOL;
  return `${sol.toFixed(2)} SOL`;
}

type EventListItem = { id: string; name: string; date: string };

export function DashboardContent() {
  const [eventsList, setEventsList] = useState<EventListItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);

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
        <div className="h-8 w-64 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700"
            />
          ))}
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
        <p className="text-center text-zinc-600 dark:text-zinc-400">{error}</p>
        <button
          type="button"
          onClick={load}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Retry
        </button>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
        <p className="text-center text-zinc-600 dark:text-zinc-400">
          No event yet.
        </p>
        <Link
          href="/dashboard/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
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
  const stats = eventData?.stats;

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <select
            value={selectedEventId ?? ''}
            onChange={handleEventChange}
            className="w-full max-w-md rounded-md border border-zinc-300 bg-white px-3 py-2 text-lg font-semibold text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-500"
            aria-label="Select event"
          >
            {eventsList.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {formatDate(e.date)}
              </option>
            ))}
          </select>
          {event && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
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
          className="shrink-0 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          New event
        </Link>
      </header>

      {detailLoading && !eventData ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
        </div>
      ) : eventData && stats ? (
        <>
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Vendors
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {stats.approved} approved / {stats.pending} pending
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {stats.totalVendors} total
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Revenue
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {formatRevenue(stats.totalRevenue)}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {stats.paid} paid
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Layout
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {stats.layoutStatus === 'generated' ? 'Generated' : 'Not generated'}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Safety
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {stats.safetyFlagsCount === 0
                  ? 'No flags'
                  : `${stats.safetyFlagsCount} flag${stats.safetyFlagsCount === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>

          <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
              Vendor applications
            </h2>
            {eventData.vendors.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No applications yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {eventData.vendors.map((v) => (
                  <li
                    key={v.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-100 py-2 pl-3 pr-2 dark:border-zinc-700"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        {v.booth_name}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {v.vendor_type}
                        {v.description ? ` · ${v.description.slice(0, 60)}${v.description.length > 60 ? "…" : ""}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          v.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : v.status === 'rejected'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}
                      >
                        {v.status}
                      </span>
                      {v.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleApprove(v.id)}
                            className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(v.id)}
                            className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500"
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

          {/* Venue Map with Grid Editor */}
          <div className="flex-1 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700" style={{ minHeight: 400 }}>
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
        </>
      ) : null}
    </div>
  );
}
