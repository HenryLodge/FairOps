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

export type VendorPortalTab = "applications" | "events";

function StatusBadge({ status }: { status: string }) {
  const style =
    status === "approved"
      ? { background: "rgba(16, 185, 129, 0.2)", color: "#34D399" }
      : status === "rejected"
        ? { background: "rgba(239, 68, 68, 0.2)", color: "#F87171" }
        : { background: "var(--color-accent-soft)", color: "var(--color-accent)" };
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize"
      style={style}
    >
      {status}
    </span>
  );
}

export function VendorPortalContent({ activeTab = "applications" }: { activeTab?: VendorPortalTab }) {
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

  const cardStyle = {
    border: "1px solid var(--color-border)",
    background: "var(--color-surface)",
    borderRadius: 12,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: "var(--color-border)", borderTopColor: "var(--color-accent)" }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-xl border p-4"
        style={{ borderColor: "rgba(239, 68, 68, 0.4)", background: "rgba(239, 68, 68, 0.08)" }}
      >
        <p className="text-sm" style={{ color: "#F87171" }}>{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-90"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        >
          Retry
        </button>
      </div>
    );
  }

  const showApplications = activeTab === "applications";
  const showEvents = activeTab === "events";

  return (
    <div className="space-y-6">
      {showApplications && (
        <section>
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--color-text)", fontFamily: "var(--font-heading)" }}
          >
            My applications
          </h2>
          {applications.length === 0 ? (
            <p className="mt-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
              You haven&apos;t applied to any events yet. Browse events and apply to get started.
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
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl p-3"
                    style={cardStyle}
                  >
                    <div>
                      <p className="font-medium" style={{ color: "var(--color-text)" }}>
                        {app.booth_name}
                      </p>
                      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                        {eventName} · {eventDate}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs capitalize" style={{ color: "var(--color-text-tertiary)" }}>
                        {app.vendor_type}
                      </span>
                      <StatusBadge status={app.status} />
                      <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                        {app.payment_status ?? "unpaid"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {showEvents && (
        <section>
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--color-text)", fontFamily: "var(--font-heading)" }}
          >
            Browse events
          </h2>
          {events.length === 0 ? (
            <p className="mt-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
              No upcoming events at the moment.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {events.map((event) => {
                const alreadyApplied = appliedEventIds.has(event.id);
                return (
                  <li
                    key={event.id}
                    className="rounded-xl p-3"
                    style={cardStyle}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium" style={{ color: "var(--color-text)" }}>
                          {event.name}
                        </p>
                        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                          {formatDate(event.date)}
                          {event.location ? ` · ${event.location}` : ""}
                        </p>
                      </div>
                      <div>
                        {alreadyApplied ? (
                          <span className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
                            Applied
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setApplyEvent({ id: event.id, name: event.name })
                            }
                            className="rounded-lg px-3 py-1.5 text-sm font-medium transition-all hover:opacity-90"
                            style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
                          >
                            Apply
                          </button>
                        )}
                      </div>
                    </div>
                    {applyEvent?.id === event.id && (
                      <div
                        className="mt-3 border-t pt-3"
                        style={{ borderColor: "var(--color-border)" }}
                      >
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
      )}
    </div>
  );
}
