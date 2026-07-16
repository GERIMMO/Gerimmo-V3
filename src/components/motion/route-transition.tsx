"use client";

import type { ReactNode } from "react";

import { usePathname } from "next/navigation";

export function RouteTransition({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="gerimmo-page-enter min-w-0">
      {children}
    </div>
  );
}
