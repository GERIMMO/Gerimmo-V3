import type { ReactNode } from "react";

import { PublicFooter, PublicHeader } from "./_components/public-shell";

export default function ExternalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}
