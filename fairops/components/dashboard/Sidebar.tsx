'use client';

import { useState } from 'react';
import { ArrowUp, Paintbrush, Settings, Plus, FlaskConical, Waves, User, Store } from 'lucide-react';
import Link from 'next/link';

const COUNTER_ITEMS = [
  { id: 'tools', label: 'Tools', icon: FlaskConical },
  { id: 'waves', label: 'Flow', icon: Waves },
  { id: 'people', label: 'People', icon: User },
  { id: 'vend', label: 'Vend', icon: Store },
] as const;

export function Sidebar() {
  const [counts, setCounts] = useState<Record<string, number>>({
    tools: 0,
    waves: 0,
    people: 0,
    vend: 0,
  });

  const adjust = (id: string, delta: number) => {
    setCounts((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }));
  };

  return (
    <aside className="dashboard-sidebar flex h-full w-56 flex-col bg-zinc-900 text-zinc-200">
      <div className="border-b border-zinc-700 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            drag & drop
          </p>
          <Link
            href="/settings"
            className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-800 hover:bg-zinc-700"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex gap-2">
          <Link
            href="#"
            className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-800 hover:bg-zinc-700"
            aria-label="Layout"
          >
            <ArrowUp className="h-4 w-4" />
          </Link>
          <Link
            href="#"
            className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-800 hover:bg-zinc-700"
            aria-label="Edit"
          >
            <Paintbrush className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="border-b border-zinc-700 p-3">
        <Link
          href="/dashboard/new"
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>New event</span>
        </Link>
      </div>

      <div className="flex-1 space-y-1 border-b border-zinc-700 p-3">
        {COUNTER_ITEMS.map(({ id, label, icon: Icon }) => (
          <div
            key={id}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-800"
          >
            <Icon className="h-4 w-4 shrink-0 text-zinc-400" />
            <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => adjust(id, -1)}
                className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                aria-label={`Decrease ${label}`}
              >
                −
              </button>
              <span className="min-w-[1.5rem] text-center text-sm tabular-nums">
                {counts[id] ?? 0}
              </span>
              <button
                type="button"
                onClick={() => adjust(id, 1)}
                className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                aria-label={`Increase ${label}`}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3">
        <button
          type="button"
          onClick={() => console.log('AI Button clicked')}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Optimize with AI
        </button>
      </div>
    </aside>
  );
}
