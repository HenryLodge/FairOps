'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Role = 'organizer' | 'vendor';

export function SetupForm() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!role) {
      setError('Please choose Organizer or Vendor.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/profile/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          displayName: displayName.trim() || undefined,
          orgName: orgName.trim() || undefined,
          businessName: businessName.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        redirectTo?: string;
      };
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        setSubmitting(false);
        return;
      }
      const redirectTo = data.redirectTo ?? (role === 'organizer' ? '/dashboard' : '/vendor');
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  const inputClass =
    'rounded-lg border px-3 py-2 text-sm bg-[var(--color-bg-elevated)] border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]';

  const labelClass = 'text-sm font-medium';
  const labelStyle = { color: 'var(--color-text-secondary)' };

  const roleCardBase = {
    border: '2px solid var(--color-border)',
    background: 'var(--color-bg-elevated)',
  };
  const roleCardSelected = {
    borderColor: 'var(--color-accent)',
    background: 'var(--color-accent-soft)',
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-6">
      <div>
        <p className="mb-3 text-sm font-medium" style={labelStyle}>
          I am a...
        </p>
        <div className="flex gap-4">
          <label
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3 transition hover:opacity-90"
            style={
              role === 'organizer'
                ? { ...roleCardBase, ...roleCardSelected }
                : roleCardBase
            }
          >
            <input
              type="radio"
              name="role"
              value="organizer"
              checked={role === 'organizer'}
              onChange={() => setRole('organizer')}
              className="sr-only"
            />
            <span className="font-medium" style={{ color: 'var(--color-text)' }}>
              Organizer
            </span>
          </label>
          <label
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3 transition hover:opacity-90"
            style={
              role === 'vendor'
                ? { ...roleCardBase, ...roleCardSelected }
                : roleCardBase
            }
          >
            <input
              type="radio"
              name="role"
              value="vendor"
              checked={role === 'vendor'}
              onChange={() => setRole('vendor')}
              className="sr-only"
            />
            <span className="font-medium" style={{ color: 'var(--color-text)' }}>
              Vendor
            </span>
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="displayName" className={labelClass} style={labelStyle}>
          Display name (optional)
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How you want to be shown"
          className={inputClass}
        />
      </div>

      {role === 'organizer' && (
        <div className="flex flex-col gap-2">
          <label htmlFor="orgName" className={labelClass} style={labelStyle}>
            Organization name (optional)
          </label>
          <input
            id="orgName"
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Your fair or company name"
            className={inputClass}
          />
        </div>
      )}

      {role === 'vendor' && (
        <div className="flex flex-col gap-2">
          <label htmlFor="businessName" className={labelClass} style={labelStyle}>
            Business / booth name (optional)
          </label>
          <input
            id="businessName"
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Your business or booth name"
            className={inputClass}
          />
        </div>
      )}

      {error && (
        <p
          className="rounded-lg px-3 py-2 text-sm"
          style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#F87171' }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-xl px-4 py-3 font-medium transition hover:opacity-90 disabled:opacity-50"
        style={{ background: 'var(--color-accent)', color: 'var(--color-bg)' }}
      >
        {submitting ? 'Saving...' : 'Complete setup'}
      </button>
    </form>
  );
}
