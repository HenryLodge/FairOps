"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { VendorPortalContent } from "./VendorPortalContent";

type Tab = "applications" | "events";

export function VendorPortalShell() {
  const [activeTab, setActiveTab] = useState<Tab>("applications");

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col p-4">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b pb-4" style={{ borderColor: "var(--color-border)" }}>
        <h1 className="text-xl font-semibold" style={{ color: "var(--color-text)", fontFamily: "var(--font-heading)", letterSpacing: "-0.02em" }}>
          Vendor Portal
        </h1>
        <div className="flex items-center gap-2">
          <WalletMultiButton />
          <Link
            href="/settings"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors hover:opacity-90"
          style={{
            borderColor: "var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-text-secondary)",
          }}
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Page selector */}
      <nav className="flex shrink-0 gap-1 pt-4" role="tablist" aria-label="Portal sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "applications"}
          onClick={() => setActiveTab("applications")}
          className="rounded-lg px-4 py-2.5 text-sm font-medium transition-all"
          style={
            activeTab === "applications"
              ? {
                  background: "var(--color-accent-soft)",
                  color: "var(--color-accent)",
                  border: "1px solid rgba(245, 158, 11, 0.25)",
                }
              : {
                  color: "var(--color-text-secondary)",
                  border: "1px solid transparent",
                }
          }
        >
          My Applications
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "events"}
          onClick={() => setActiveTab("events")}
          className="rounded-lg px-4 py-2.5 text-sm font-medium transition-all"
          style={
            activeTab === "events"
              ? {
                  background: "var(--color-accent-soft)",
                  color: "var(--color-accent)",
                  border: "1px solid rgba(245, 158, 11, 0.25)",
                }
              : {
                  color: "var(--color-text-secondary)",
                  border: "1px solid transparent",
                }
          }
        >
          Browse Events
        </button>
      </nav>

      <div className="min-h-0 flex-1 pt-6">
        <VendorPortalContent activeTab={activeTab} />
      </div>
    </div>
  );
}
