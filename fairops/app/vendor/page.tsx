import { requireRole } from "@/lib/auth";
import Link from "next/link";
import { Settings } from "lucide-react";
import { VendorPortalContent } from "../../components/vendor/VendorPortalContent";

export default async function VendorPage() {
  await requireRole("vendor");

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col p-4">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-700">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Vendor Portal
        </h1>
        <Link
          href="/settings"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </header>
      <div className="min-h-0 flex-1 pt-6">
        <VendorPortalContent />
      </div>
    </div>
  );
}
