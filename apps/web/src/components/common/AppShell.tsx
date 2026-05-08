"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { clearSession, getStoredUser, type AuthUser } from "@/lib/api-client";
import { dashboardFor } from "@/lib/navigation";

const navItemsByRole: Record<AuthUser["role"], { href: string; label: string }[]> = {
  student: [{ href: "/student/dashboard", label: "Học tập" }],
  teacher: [{ href: "/teacher", label: "Giảng dạy" }],
  coach: [{ href: "/teacher", label: "Giảng dạy" }],
  admin: [
    { href: "/student/dashboard", label: "Học tập" },
    { href: "/teacher", label: "Giảng dạy" },
    { href: "/admin", label: "Quản trị" }
  ]
};

interface AppShellProps {
  children: ReactNode;
  allowedRoles?: AuthUser["role"][];
}

export function AppShell({ allowedRoles, children }: AppShellProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    setReady(true);

    if (!stored) {
      router.replace("/login");
      return;
    }

    if (allowedRoles && !allowedRoles.includes(stored.role)) {
      router.replace(dashboardFor(stored.role));
    }
  }, [allowedRoles, router]);

  function handleLogout() {
    clearSession();
    setUser(null);
    router.push("/login");
  }

  if (!ready || !user || (allowedRoles && !allowedRoles.includes(user.role))) {
    return (
      <main className="grid min-h-screen place-items-center bg-surface px-6 text-ink">
        <div className="rounded-lg border border-line bg-white px-5 py-4 text-sm font-medium text-muted shadow-sm">
          Đang mở không gian làm việc...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Link href="/" className="text-lg font-semibold">
            MindHub LMS
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <>
                {navItemsByRole[user.role].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-md px-3 py-2 hover:bg-surface hover:text-ink"
                  >
                    {item.label}
                  </Link>
                ))}
                <span className="rounded-md bg-surface px-3 py-2 text-ink">
                  {user.fullName}
                </span>
                <button
                  className="rounded-md border border-line bg-white px-3 py-2 font-medium text-ink hover:bg-surface"
                  onClick={handleLogout}
                  type="button"
                >
                  Đăng xuất
                </button>
            </>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
    </main>
  );
}
