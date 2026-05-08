"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { getStoredUser } from "@/lib/api-client";
import { dashboardFor } from "@/lib/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const user = getStoredUser();
    router.replace(user ? dashboardFor(user.role) : "/login");
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center bg-surface px-6 text-ink">
      <div className="text-center">
        <p className="text-lg font-semibold">MindHub LMS</p>
        <p className="mt-2 text-sm text-muted">Loading workspace...</p>
      </div>
    </main>
  );
}
