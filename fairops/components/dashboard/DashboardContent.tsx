'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

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
  };
  vendors: unknown[];
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

export function DashboardContent() {
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEmpty(false);
    setEventData(null);

    try {
      const listRes = await fetch('/api/events');
      if (!listRes.ok) {
        const body = await listRes.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error || `Failed to load events (${listRes.status})`
        );
      }
      const listBody = (await listRes.json()) as { events: { id: string }[] };
      const events = listBody.events ?? [];
      if (events.length === 0) {
        setEmpty(true);
        setLoading(false);
        return;
      }

      const eventId = events[0].id;
      const fatRes = await fetch(`/api/events/${eventId}`);
      if (!fatRes.ok) {
        const body = await fatRes.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error || `Failed to load event (${fatRes.status})`
        );
      }
      const fatBody = (await fatRes.json()) as EventData;
      setEventData(fatBody);
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

  if (!eventData) {
    return null;
  }

  const { event, stats } = eventData;

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <header>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {event.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {formatDate(event.date)}
          {event.location ? ` · ${event.location}` : ''}
          {event.expected_attendance != null
            ? ` · ${event.expected_attendance.toLocaleString()} expected`
            : ''}
        </p>
      </header>

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

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1" />
        <div className="dashboard-ai-area shrink-0 rounded-lg border border-zinc-200 bg-white/80 p-3 backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/80">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            AI reasoning & safety notes
          </p>
          <p className="mt-1 text-xs text-zinc-500">AI output will appear here.</p>
        </div>
      </div>

      <div className="dashboard-map green-glass flex flex-1 flex-col items-center justify-center rounded-xl border border-emerald-200/50 bg-emerald-500/10 p-6 backdrop-blur-sm dark:border-emerald-800/50 dark:bg-emerald-950/30">
        <h2 className="text-lg font-medium text-emerald-900 dark:text-emerald-100">
          Map layout
        </h2>
        <p className="mt-1 text-sm text-emerald-700/80 dark:text-emerald-300/80">
          Venue layout
        </p>
        <div
          className="mt-6 grid gap-1"
          style={{
            gridTemplateColumns: 'repeat(4, 3rem)',
            gridTemplateRows: 'repeat(3, 3rem)',
          }}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="rounded border border-emerald-300/50 bg-white/20 dark:border-emerald-700/50 dark:bg-white/5"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
