"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function NavigationProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const running = useRef(false);
  const safetyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finishProgress = useCallback(() => {
    if (!running.current) return;

    running.current = false;
    setFinishing(true);
    finishTimeout.current = setTimeout(() => {
      setActive(false);
      setFinishing(false);
    }, 220);
  }, []);

  useEffect(() => {
    function startProgress(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (`${destination.pathname}${destination.search}` === `${window.location.pathname}${window.location.search}`)
        return;

      setFinishing(false);
      setActive(true);
      running.current = true;

      if (safetyTimeout.current) clearTimeout(safetyTimeout.current);
      if (finishTimeout.current) clearTimeout(finishTimeout.current);
      safetyTimeout.current = setTimeout(finishProgress, 8_000);
    }

    document.addEventListener("click", startProgress, true);
    return () => {
      document.removeEventListener("click", startProgress, true);
      if (safetyTimeout.current) clearTimeout(safetyTimeout.current);
      if (finishTimeout.current) clearTimeout(finishTimeout.current);
    };
  }, [finishProgress]);

  useEffect(() => {
    void pathname;
    finishProgress();
  }, [pathname, finishProgress]);

  return (
    <div
      aria-hidden="true"
      data-active={active || undefined}
      data-finishing={finishing || undefined}
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 origin-left scale-x-0 bg-primary opacity-0",
        "data-active:animate-[gerimmo-progress_8s_cubic-bezier(0.2,0,0,1)_forwards] data-active:opacity-100",
        "data-finishing:scale-x-100 data-finishing:animate-none data-finishing:opacity-0",
      )}
    />
  );
}
