function report(payload: Record<string, unknown>) {
  try {
    navigator.sendBeacon("/api/observability", new Blob([JSON.stringify(payload)], { type: "application/json" }));
  } catch {
    // Client monitoring is deliberately best effort.
  }
}

window.addEventListener("error", (event) =>
  report({
    source: "browser",
    eventType: "javascript.error",
    severity: "error",
    message: event.message || "Erreur JavaScript",
    screenPath: window.location.pathname,
    metadata: { file: event.filename, line: event.lineno, column: event.colno },
  }),
);
window.addEventListener("unhandledrejection", (event) =>
  report({
    source: "browser",
    eventType: "javascript.unhandled_rejection",
    severity: "error",
    message: event.reason instanceof Error ? event.reason.message : String(event.reason),
    screenPath: window.location.pathname,
  }),
);
window.addEventListener(
  "load",
  () => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navigation)
      report({
        source: "browser",
        eventType: "page.performance",
        severity: navigation.duration > 3000 ? "warning" : "info",
        message: "Chargement de page",
        screenPath: window.location.pathname,
        durationMs: Math.round(navigation.duration),
        metadata: {
          domContentLoaded: Math.round(navigation.domContentLoadedEventEnd),
          transferSize: navigation.transferSize,
        },
      });
  },
  { once: true },
);

export function onRouterTransitionStart(url: string, navigationType: "push" | "replace" | "traverse") {
  performance.mark(`gerimmo-navigation-${Date.now()}`);
  report({
    source: "browser",
    eventType: "navigation.started",
    severity: "info",
    message: `Navigation ${navigationType}`,
    screenPath: url,
  });
}
