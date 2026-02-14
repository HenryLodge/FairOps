'use client';

import { useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';

const QUICK_ACTIONS = [
  'Vendor mix analysis',
  'Safety checklist',
  'Generate vendor email',
  'Day-of timeline',
] as const;

type MessageRole = 'user' | 'assistant';

interface Message {
  id: string;
  role: MessageRole;
  content: string;
}

const PLACEHOLDER_MESSAGES: Message[] = [
  { id: '1', role: 'user', content: 'Do I have enough food vendors?' },
  {
    id: '2',
    role: 'assistant',
    content: 'AI responses will appear here once Gemini is connected.',
  },
];

export function RightPanel() {
  const [input, setInput] = useState('');
  const [messages] = useState<Message[]>(PLACEHOLDER_MESSAGES);

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    console.log('Copilot message (no API yet):', input.trim());
    setInput('');
  };

  return (
    <aside className="dashboard-right-panel flex h-full w-96 flex-col border-l border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <header className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <MessageSquare className="h-5 w-5 text-zinc-500" aria-hidden />
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Copilot
        </h2>
      </header>

      <div className="copilot-messages flex min-h-0 flex-1 flex-col overflow-auto p-3">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            Ask me about vendors, layout, or operations.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((msg) => (
              <li
                key={msg.id}
                className={
                  msg.role === 'user'
                    ? 'ml-8 flex justify-end'
                    : 'mr-8 flex justify-start'
                }
              >
                <span
                  className={
                    msg.role === 'user'
                      ? 'rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100'
                      : 'rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                  }
                >
                  {msg.content}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="copilot-input shrink-0 border-t border-zinc-200 p-3 dark:border-zinc-700">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => handleQuickAction(label)}
              className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {label}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your event..."
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800 dark:placeholder:text-zinc-500"
            aria-label="Message"
          />
          <button
            type="submit"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </aside>
  );
}
