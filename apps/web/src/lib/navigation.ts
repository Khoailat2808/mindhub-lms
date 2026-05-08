import type { AuthUser } from "@/lib/api-client";

export function dashboardFor(role: AuthUser["role"]) {
  if (role === "student") {
    return "/student/dashboard";
  }

  if (role === "admin") {
    return "/admin";
  }

  return "/teacher";
}
