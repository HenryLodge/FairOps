import { verifyAuth } from "@/lib/auth";
import ResetSetupButton from "@/components/settings/ResetSetupButton";
import VendorInfoEditor from "@/components/settings/VendorInfoEditor";

export default async function SettingsPage() {
  await verifyAuth();

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Settings
      </h1>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Developer
        </h2>
        <div className="flex flex-col gap-3">
          <ResetSetupButton />
          <VendorInfoEditor />
          <a href="/auth/logout" className="button logout inline-block text-center">
            Log out
          </a>
        </div>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Reset setup clears your saved role so you can choose organizer or
          vendor again on the next load. Vendors can edit their application
          details (booth name, type, description, space, power) for each event above.
        </p>
      </section>
    </div>
  );
}
