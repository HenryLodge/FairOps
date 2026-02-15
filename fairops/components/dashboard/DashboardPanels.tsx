'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { RightPanel } from './RightPanel';

const RIGHT_PANEL_MIN = 280;
const RIGHT_PANEL_MAX = 720;
const RIGHT_PANEL_DEFAULT = 384;

export function DashboardPanels({ children }: { children: React.ReactNode }) {
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [rightPanelWidth, setRightPanelWidth] = useState(RIGHT_PANEL_DEFAULT);
  const [isResizing, setIsResizing] = useState(false);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const onMove = (e: MouseEvent) => {
      const newW = window.innerWidth - e.clientX;
      setRightPanelWidth(Math.min(RIGHT_PANEL_MAX, Math.max(RIGHT_PANEL_MIN, newW)));
    };
    const onUp = () => setIsResizing(false);

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <main
        className="dashboard-main min-h-0 min-w-0 flex-1 overflow-auto"
        style={{ background: 'var(--color-bg)' }}
      >
        {children}
      </main>

      {rightPanelOpen ? (
        <>
          <div
            role="separator"
            aria-label="Resize Event Assistant panel"
            onMouseDown={startResize}
            className="dashboard-right-resize w-1 shrink-0 cursor-col-resize border-l transition-colors hover:bg-[var(--color-accent)]/20"
            style={{ borderColor: 'var(--color-border)' }}
          />
          <div className="h-full shrink-0" style={{ width: rightPanelWidth }}>
            <RightPanel onClose={() => setRightPanelOpen(false)} />
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setRightPanelOpen(true)}
          className="flex h-full w-10 shrink-0 flex-col items-center justify-center gap-1 border-l py-4 transition-colors hover:opacity-90"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text-secondary)',
          }}
          aria-label="Open Event Assistant"
        >
          <MessageSquare className="h-5 w-5" />
          <span className="text-[10px] font-medium uppercase tracking-wider">Assistant</span>
        </button>
      )}
    </div>
  );
}
