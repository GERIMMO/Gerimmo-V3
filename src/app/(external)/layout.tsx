import type { ReactNode } from "react";

import { NavigationProgress } from "@/components/motion/navigation-progress";
import { RouteTransition } from "@/components/motion/route-transition";

import { PublicFooter, PublicHeader } from "./_components/public-shell";

export default function ExternalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <NavigationProgress />
      <PublicHeader />
      <main>
        <RouteTransition>{children}</RouteTransition>
      </main>
      <PublicFooter />
    </div>
  );
}
