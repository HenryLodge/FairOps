import { DashboardStatsProvider } from '@/components/dashboard/DashboardStatsContext';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { RightPanel } from '@/components/dashboard/RightPanel';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardStatsProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <Sidebar />
        <main className="dashboard-main min-h-0 flex-1 overflow-auto" style={{ background: 'var(--color-bg)' }}>
          {children}
        </main>
        <RightPanel />
      </div>
    </DashboardStatsProvider>
  );
}
