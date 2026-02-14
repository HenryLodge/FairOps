import { DashboardStatsProvider } from '@/components/dashboard/DashboardStatsContext';
import { DashboardPanels } from '@/components/dashboard/DashboardPanels';
import { Sidebar } from '@/components/dashboard/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardStatsProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <Sidebar />
        <DashboardPanels>{children}</DashboardPanels>
      </div>
    </DashboardStatsProvider>
  );
}
