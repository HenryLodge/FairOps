"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetSetupButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile/reset-setup", { method: "POST" });
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert((body as { error?: string }).error ?? "Failed to reset setup");
        return;
      }
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="button logout"
    >
      {loading ? "Resetting…" : "Reset organizer/vendor setup"}
    </button>
  );
}
