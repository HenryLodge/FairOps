'use client';

import { useState } from 'react';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface LayoutData {
  id: string;
  image?: string;
  mimeType?: string;
  reasoning: string | null;
  safetyNotes?: string[];
}

interface LayoutDisplayProps {
  layout: LayoutData | null;
  onRefine: (feedback: string) => void;
  isOptimizing: boolean;
  isRefining: boolean;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function LayoutDisplay({
  layout,
  onRefine,
  isOptimizing,
  isRefining,
}: LayoutDisplayProps) {
  const [feedback, setFeedback] = useState('');

  const busy = isOptimizing || isRefining;

  /* ---- Loading / empty states ---- */
  if (isOptimizing && !layout) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <div
          className="h-10 w-10 animate-spin rounded-full border-[3px] border-t-transparent"
          style={{
            borderColor: 'var(--color-border)',
            borderTopColor: 'var(--color-accent)',
          }}
        />
        <p
          className="text-sm font-medium"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Generating AI layout&hellip; this may take 5-10 seconds
        </p>
      </div>
    );
  }

  if (!layout) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-12 w-12 opacity-30"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.75 3.75h4.5m-4.5 0A2.25 2.25 0 007.5 6v1.5m2.25-3.75h4.5A2.25 2.25 0 0116.5 6v1.5M7.5 7.5h9m-9 0v10.5A2.25 2.25 0 009.75 20.25h4.5A2.25 2.25 0 0016.5 18V7.5"
          />
        </svg>
        <p
          className="text-center text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          No AI layout yet. Click <strong>Optimize with AI</strong> in the
          sidebar to generate one.
        </p>
      </div>
    );
  }

  const imageSrc = layout.image
    ? `data:${layout.mimeType ?? 'image/png'};base64,${layout.image}`
    : null;

  const handleSubmitRefine = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = feedback.trim();
    if (!trimmed || busy) return;
    onRefine(trimmed);
    setFeedback('');
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      {/* ---- Spinner overlay when refining ---- */}
      {isRefining && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
          style={{
            background: 'var(--color-accent-soft)',
            color: 'var(--color-accent)',
          }}
        >
          <div
            className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
            style={{
              borderColor: 'var(--color-accent)',
              borderTopColor: 'transparent',
            }}
          />
          Refining layout&hellip;
        </div>
      )}

      {/* ---- Generated layout image ---- */}
      {imageSrc && (
        <div
          className="overflow-hidden rounded-xl border"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt="AI-generated venue layout"
            className="h-auto w-full"
          />
        </div>
      )}

      {/* ---- Reasoning panel ---- */}
      {layout.reasoning && (
        <details open className="group">
          <summary
            className="flex cursor-pointer items-center gap-2 text-sm font-semibold uppercase tracking-wider select-none"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 transition-transform group-open:rotate-90"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            AI Reasoning
          </summary>
          <div
            className="mt-2 rounded-lg border p-3 text-sm leading-relaxed whitespace-pre-wrap"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
            }}
          >
            {layout.reasoning}
          </div>
        </details>
      )}

      {/* ---- Safety notes ---- */}
      {layout.safetyNotes && layout.safetyNotes.length > 0 && (
        <div
          className="rounded-lg border p-3"
          style={{
            borderColor: 'rgba(239, 68, 68, 0.4)',
            background: 'rgba(239, 68, 68, 0.08)',
          }}
        >
          <h3
            className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider"
            style={{ color: '#F87171' }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Safety Notes
          </h3>
          <ul className="space-y-1">
            {layout.safetyNotes.map((note, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm"
                style={{ color: 'var(--color-text)' }}
              >
                <span style={{ color: '#F87171' }} className="mt-0.5 shrink-0">
                  &bull;
                </span>
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---- Refine feedback input ---- */}
      <form onSubmit={handleSubmitRefine} className="mt-auto flex gap-2">
        <input
          type="text"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="e.g. Move food vendors closer to the entrance"
          disabled={busy}
          className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm placeholder:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] disabled:opacity-50"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
          }}
        />
        <button
          type="submit"
          disabled={busy || feedback.trim().length === 0}
          className="shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: 'var(--color-accent)',
            color: 'var(--color-bg)',
          }}
        >
          {isRefining ? 'Refining…' : 'Refine'}
        </button>
      </form>
    </div>
  );
}
