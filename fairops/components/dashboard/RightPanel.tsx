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
    <aside
      className="dashboard-right-panel flex h-full w-96 flex-col border-l"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <header className="flex shrink-0 items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
        <MessageSquare className="h-5 w-5" style={{ color: 'var(--color-text-tertiary)' }} aria-hidden />
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          Copilot
        </h2>
      </header>

      <div className="copilot-messages flex min-h-0 flex-1 flex-col overflow-auto p-3">
        {messages.length === 0 ? (
          <p className="text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
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
                  className="rounded-lg px-3 py-2 text-sm"
                  style={
                    msg.role === 'user'
                      ? { background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }
                      : { background: 'var(--color-bg-elevated)', color: 'var(--color-text)' }
                  }
                >
                  {msg.content}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="copilot-input shrink-0 border-t p-3" style={{ borderColor: 'var(--color-border)' }}>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => handleQuickAction(label)}
              className="rounded-full px-2.5 py-1 text-xs hover:opacity-90"
              style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}
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
            className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-bg-elevated)',
              color: 'var(--color-text)',
            }}
            aria-label="Message"
          />
          <button
            type="submit"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:opacity-90"
            style={{ background: 'var(--color-accent)', color: 'var(--color-bg)' }}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </aside>
  );
}
