import type { ReactNode } from "react";

import { requireSuperAdminPage } from "@/lib/auth/guards";

export default async function LegacySuperAdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireSuperAdminPage();
  return children;
}
