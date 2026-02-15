'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { MessageSquare, Send, PanelRightClose, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useDashboardStats } from './DashboardStatsContext';

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

type RightPanelProps = {
  onClose?: () => void;
};

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const markdownComponents = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-2 list-disc pl-5 space-y-0.5 last:mb-0" style={{ color: 'var(--color-text)' }}>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal pl-5 space-y-0.5 last:mb-0" style={{ color: 'var(--color-text)' }}>
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-snug">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  h1: ({ children }) => (
    <h1 className="text-base font-semibold mt-3 mb-1 first:mt-0" style={{ color: 'var(--color-text)' }}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-semibold mt-3 mb-1 first:mt-0" style={{ color: 'var(--color-text)' }}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-medium mt-2 mb-1 first:mt-0" style={{ color: 'var(--color-text)' }}>
      {children}
    </h3>
  ),
};

export function RightPanel({ onClose }: RightPanelProps) {
  const { eventId } = useDashboardStats();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!eventId) {
      setMessages([]);
      return;
    }
    setLoadingHistory(true);
    fetch(`/api/copilot/chat?eventId=${encodeURIComponent(eventId)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load chat');
        return res.json();
      })
      .then((data: { messages?: { id: string; role: string; content: string }[] }) => {
        const list = data.messages ?? [];
        setMessages(
          list.map((m) => ({
            id: m.id,
            role: m.role as MessageRole,
            content: m.content,
          }))
        );
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingHistory(false));
  }, [eventId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!eventId || !text.trim()) return;
      const trimmed = text.trim();
      const userMsg: Message = {
        id: generateId(),
        role: 'user',
        content: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setSending(true);
      try {
        const res = await fetch('/api/copilot/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId, message: trimmed }),
        });
        const data = (await res.json()) as { reply?: string; error?: string };
        if (!res.ok) {
          const errText = data.error ?? 'Something went wrong';
          setMessages((prev) => [
            ...prev,
            { id: generateId(), role: 'assistant', content: `Error: ${errText}` },
          ]);
          return;
        }
        setMessages((prev) => [
          ...prev,
          { id: generateId(), role: 'assistant', content: data.reply ?? '' },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'assistant',
            content: `Error: ${err instanceof Error ? err.message : 'Failed to send'}`,
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [eventId]
  );

  const handleQuickAction = useCallback(
    (prompt: string) => {
      sendMessage(prompt);
    },
    [sendMessage]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim()) return;
      sendMessage(input);
    },
    [input, sendMessage]
  );

  const noEvent = !eventId;
  const emptyState = !loadingHistory && messages.length === 0;

  return (
    <aside
      className="dashboard-right-panel flex h-full w-full min-w-0 flex-col"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <header
        className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <MessageSquare
            className="h-5 w-5 shrink-0"
            style={{ color: 'var(--color-text-tertiary)' }}
            aria-hidden
          />
          <h2 className="truncate text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            Event Assistant
          </h2>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:opacity-80"
            style={{ color: 'var(--color-text-secondary)' }}
            aria-label="Close Event Assistant panel"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        )}
      </header>

      <div
        className="copilot-messages flex min-h-0 flex-1 flex-col overflow-auto p-3"
        style={{ minHeight: 0 }}
      >
        {loadingHistory ? (
          <p className="text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Loading chat…
          </p>
        ) : noEvent ? (
          <p className="text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Select an event to start chatting.
          </p>
        ) : emptyState ? (
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
                <div
                  className={
                    msg.role === 'user'
                      ? 'rounded-lg px-3 py-2 text-sm max-w-[85%]'
                      : 'rounded-lg px-3 py-2 text-sm max-w-[85%]'
                  }
                  style={
                    msg.role === 'user'
                      ? { background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }
                      : {
                          background: 'var(--color-bg-elevated)',
                          color: 'var(--color-text)',
                        }
                  }
                >
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown components={markdownComponents}>
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div
        className="copilot-input shrink-0 border-t p-3"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => handleQuickAction(label)}
              disabled={noEvent || sending}
              className="rounded-full px-2.5 py-1 text-xs hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'var(--color-bg-elevated)',
                color: 'var(--color-text-secondary)',
              }}
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
            placeholder={
              noEvent ? 'Select an event to chat…' : 'Ask about your event...'
            }
            disabled={noEvent || sending}
            className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-bg-elevated)',
              color: 'var(--color-text)',
            }}
            aria-label="Message"
          />
          <button
            type="submit"
            disabled={noEvent || sending || !input.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--color-accent)', color: 'var(--color-bg)' }}
            aria-label="Send"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
      </div>
    </aside>
  );
}
