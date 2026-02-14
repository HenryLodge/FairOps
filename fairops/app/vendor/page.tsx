import { requireRole } from "@/lib/auth";
import { VendorPortalShell } from "../../components/vendor/VendorPortalShell";

export default async function VendorPage() {
  await requireRole("vendor");

  return (
    <div className="min-h-full w-full">
      <VendorPortalShell />
    </div>
  );
}
