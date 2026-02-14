'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NewEventPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [expectedAttendance, setExpectedAttendance] = useState('');
  const [venueWidth, setVenueWidth] = useState('');
  const [venueHeight, setVenueHeight] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !date.trim() || !location.trim()) {
      setError('Name, date, and location are required.');
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        date: date.trim().slice(0, 10),
        location: location.trim(),
      };
      if (expectedAttendance.trim()) {
        const n = parseInt(expectedAttendance, 10);
        if (!Number.isNaN(n)) body.expected_attendance = n;
      }
      if (venueWidth.trim()) {
        const n = parseInt(venueWidth, 10);
        if (!Number.isNaN(n)) body.venue_width = n;
      }
      if (venueHeight.trim()) {
        const n = parseInt(venueHeight, 10);
        if (!Number.isNaN(n)) body.venue_height = n;
      }
      if (description.trim()) body.description = description.trim();

      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        setSubmitting(false);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border px-3 py-2 text-sm bg-[var(--color-bg-elevated)] border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]';
  const labelClass = 'mb-1 block text-sm font-medium';
  const labelStyle = { color: 'var(--color-text-secondary)' };

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-sm hover:opacity-90"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Back to dashboard
        </Link>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-heading)' }}>
          Create event
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
        {error && (
          <p
            className="rounded-lg p-2 text-sm"
            style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#F87171' }}
          >
            {error}
          </p>
        )}
        <div>
          <label htmlFor="name" className={labelClass} style={labelStyle}>
            Name (required)
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="date" className={labelClass} style={labelStyle}>
            Date (required)
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="location" className={labelClass} style={labelStyle}>
            Location (required)
          </label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="expectedAttendance" className={labelClass} style={labelStyle}>
            Expected attendance (optional)
          </label>
          <input
            id="expectedAttendance"
            type="number"
            min={1}
            value={expectedAttendance}
            onChange={(e) => setExpectedAttendance(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="venueWidth" className={labelClass} style={labelStyle}>
              Venue width (grid units, optional)
            </label>
            <input
              id="venueWidth"
              type="number"
              min={1}
              value={venueWidth}
              onChange={(e) => setVenueWidth(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="venueHeight" className={labelClass} style={labelStyle}>
              Venue height (grid units, optional)
            </label>
            <input
              id="venueHeight"
              type="number"
              min={1}
              value={venueHeight}
              onChange={(e) => setVenueHeight(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label htmlFor="description" className={labelClass} style={labelStyle}>
            Description (optional)
          </label>
          <textarea
            id="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--color-accent)', color: 'var(--color-bg)' }}
          >
            {submitting ? 'Creating…' : 'Create event'}
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:opacity-90"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
