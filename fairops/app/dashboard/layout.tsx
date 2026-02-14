import { Sidebar } from '@/components/dashboard/Sidebar';
import { RightPanel } from '@/components/dashboard/RightPanel';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <main className="dashboard-main min-h-0 flex-1 overflow-auto bg-zinc-50 dark:bg-zinc-950">
        {children}
      </main>
      <RightPanel />
    </div>
  );
}
