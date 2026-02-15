'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

export type Attractions = Record<string, number>;

export type DashboardStats = {
  totalVendors: number;
  approved: number;
  pending: number;
  rejected: number;
  paid: number;
  totalRevenue: number;
  layoutStatus: 'none' | 'generated';
  safetyFlagsCount: number;
};

type SaveAttractionsFn = (a: Attractions) => Promise<void>;

type ContextValue = {
  stats: DashboardStats | null;
  setStats: (stats: DashboardStats | null) => void;
  /** Current selected event ID (set by DashboardContent) */
  eventId: string | null;
  setEventId: (id: string | null) => void;
  /** Attractions counters for the current event (loaded from DB) */
  attractions: Attractions;
  setAttractions: (a: Attractions) => void;
  /** Register a save-attractions callback (set by DashboardContent) */
  registerSaveAttractions: (fn: SaveAttractionsFn | null) => void;
  /** Call to persist attractions — delegates to the registered callback */
  saveAttractions: (a: Attractions) => Promise<void>;
};

const DashboardStatsContext = createContext<ContextValue | null>(null);

export function DashboardStatsProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [attractions, setAttractions] = useState<Attractions>({});

  /* Store the save function in a ref to avoid useState-with-function pitfalls */
  const saveRef = useRef<SaveAttractionsFn | null>(null);

  const registerSaveAttractions = useCallback((fn: SaveAttractionsFn | null) => {
    saveRef.current = fn;
  }, []);

  const saveAttractions = useCallback(async (a: Attractions) => {
    await saveRef.current?.(a);
  }, []);

  return (
    <DashboardStatsContext.Provider
      value={{
        stats,
        setStats,
        eventId,
        setEventId,
        attractions,
        setAttractions,
        registerSaveAttractions,
        saveAttractions,
      }}
    >
      {children}
    </DashboardStatsContext.Provider>
  );
}

export function useDashboardStats() {
  const ctx = useContext(DashboardStatsContext);
  if (!ctx) throw new Error('useDashboardStats must be used within DashboardStatsProvider');
  return ctx;
}

const LAMPORTS_PER_SOL = 1_000_000_000;
export function formatRevenue(lamports: number): string {
  const sol = lamports / LAMPORTS_PER_SOL;
  return `${sol.toFixed(2)} SOL`;
}
