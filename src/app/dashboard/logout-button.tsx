"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });

      if (!response.ok) {
        setError("Logout failed. Please try again.");
        setLoading(false);
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setError("Unable to log out. Check your connection.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 disabled:opacity-60"
      >
        {loading ? "Signing out..." : "Sign out"}
      </button>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}