'use client';

import { createContext, useCallback, useContext, useState } from 'react';

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

type ContextValue = {
  stats: DashboardStats | null;
  setStats: (stats: DashboardStats | null) => void;
};

const DashboardStatsContext = createContext<ContextValue | null>(null);

export function DashboardStatsProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  return (
    <DashboardStatsContext.Provider value={{ stats, setStats }}>
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
