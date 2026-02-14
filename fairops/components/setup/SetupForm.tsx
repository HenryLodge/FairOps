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

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-6">
      <div>
        <p className="mb-3 text-sm font-medium text-zinc-300">I am a...</p>
        <div className="flex gap-4">
          <label
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 transition hover:border-emerald-500/50 hover:bg-zinc-800 ${
              role === 'organizer'
                ? 'border-emerald-500 bg-emerald-500/20'
                : 'border-zinc-600 bg-zinc-800/50'
            }`}
          >
            <input
              type="radio"
              name="role"
              value="organizer"
              checked={role === 'organizer'}
              onChange={() => setRole('organizer')}
              className="sr-only"
            />
            <span className="font-medium">Organizer</span>
          </label>
          <label
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 transition hover:border-emerald-500/50 hover:bg-zinc-800 ${
              role === 'vendor'
                ? 'border-emerald-500 bg-emerald-500/20'
                : 'border-zinc-600 bg-zinc-800/50'
            }`}
          >
            <input
              type="radio"
              name="role"
              value="vendor"
              checked={role === 'vendor'}
              onChange={() => setRole('vendor')}
              className="sr-only"
            />
            <span className="font-medium">Vendor</span>
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="displayName" className="text-sm font-medium text-zinc-300">
          Display name (optional)
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How you want to be shown"
          className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {role === 'organizer' && (
        <div className="flex flex-col gap-2">
          <label htmlFor="orgName" className="text-sm font-medium text-zinc-300">
            Organization name (optional)
          </label>
          <input
            id="orgName"
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Your fair or company name"
            className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      )}

      {role === 'vendor' && (
        <div className="flex flex-col gap-2">
          <label htmlFor="businessName" className="text-sm font-medium text-zinc-300">
            Business / booth name (optional)
          </label>
          <input
            id="businessName"
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Your business or booth name"
            className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
      >
        {submitting ? 'Saving...' : 'Complete setup'}
      </button>
    </form>
  );
}
