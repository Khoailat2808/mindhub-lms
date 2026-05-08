import type React from "react";

import { StudentLayout } from "@/features/student/components";

export default function StudentAreaLayout({ children }: { children: React.ReactNode }) {
  return <StudentLayout>{children}</StudentLayout>;
}
