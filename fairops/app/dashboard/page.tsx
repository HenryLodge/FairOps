import { requireRole } from "@/lib/auth";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import Image from "next/image";

export default async function DashboardPage() {
  const { user, roles } = await requireRole("organizer");

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Organizer Dashboard
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <Image
              src={user.picture || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%2363b3ed'/%3E%3C/svg%3E"}
              alt={user.name || "User"}
              width={32}
              height={32}
              className="rounded-full"
              unoptimized
            />
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{user.name}</span>
            <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs dark:bg-zinc-700">
              {roles.join(", ")}
            </span>
          </div>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <DashboardContent />
      </div>
    </div>
  );
}
