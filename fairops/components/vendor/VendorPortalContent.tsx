"use client";

import { useState, useEffect, useCallback } from "react";
import { ApplyForm } from "./ApplyForm";

type EventInfo = {
  id: string;
  name: string;
  date: string;
  location: string;
};

type VendorRow = {
  id: string;
  event_id: string;
  booth_name: string;
  vendor_type: string;
  status: string;
  payment_status: string;
  event?: EventInfo | null;
  events?: EventInfo | null; // Supabase may return relation as table name
};

type EventRow = {
  id: string;
  name: string;
  date: string;
  location: string;
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === "approved"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
      : status === "rejected"
        ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${style}`}
    >
      {status}
    </span>
  );
}

export function VendorPortalContent() {
  const [applications, setApplications] = useState<VendorRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyEvent, setApplyEvent] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [vendorsRes, eventsRes] = await Promise.all([
        fetch("/api/vendors"),
        fetch("/api/events"),
      ]);

      if (!vendorsRes.ok) {
        const body = await vendorsRes.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? "Failed to load applications"
        );
      }
      if (!eventsRes.ok) {
        const body = await eventsRes.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? "Failed to load events"
        );
      }

      const vendorsBody = (await vendorsRes.json()) as { vendors: VendorRow[] };
      const eventsBody = (await eventsRes.json()) as { events: EventRow[] };
      setApplications(vendorsBody.vendors ?? []);
      setEvents(eventsBody.events ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const appliedEventIds = new Set(applications.map((a) => a.event_id));

  const handleApplySuccess = useCallback(() => {
    setApplyEvent(null);
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
        <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-2 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* My applications */}
      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          My applications
        </h2>
        {applications.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            You haven&apos;t applied to any events yet. Browse events below and
            apply to get started.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {applications.map((app) => {
              const eventInfo = app.event ?? app.events;
              const eventName =
                eventInfo?.name ?? `Event ${app.event_id.slice(0, 8)}`;
              const eventDate = eventInfo?.date
                ? formatDate(eventInfo.date)
                : "—";
              return (
                <li
                  key={app.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {app.booth_name}
                    </p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {eventName} · {eventDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs capitalize text-zinc-500 dark:text-zinc-400">
                      {app.vendor_type}
                    </span>
                    <StatusBadge status={app.status} />
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {app.payment_status ?? "unpaid"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Browse events */}
      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Browse events
        </h2>
        {events.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            No upcoming events at the moment.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {events.map((event) => {
              const alreadyApplied = appliedEventIds.has(event.id);
              return (
                <li
                  key={event.id}
                  className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        {event.name}
                      </p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {formatDate(event.date)}
                        {event.location ? ` · ${event.location}` : ""}
                      </p>
                    </div>
                    <div>
                      {alreadyApplied ? (
                        <span className="text-sm text-zinc-500 dark:text-zinc-400">
                          Applied
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setApplyEvent({ id: event.id, name: event.name })
                          }
                          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                        >
                          Apply
                        </button>
                      )}
                    </div>
                  </div>
                  {applyEvent?.id === event.id && (
                    <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                      <ApplyForm
                        eventId={applyEvent.id}
                        eventName={applyEvent.name}
                        onSuccess={handleApplySuccess}
                        onCancel={() => setApplyEvent(null)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
