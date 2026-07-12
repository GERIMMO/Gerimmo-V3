import type { Instrumentation } from "next";

export function register() {
  // Reserved for a vendor-neutral OpenTelemetry exporter.
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const message = error instanceof Error ? error.message : String(error);
    const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;
    await createAdminClient()
      .from("observability_events")
      .insert({
        correlation_id: crypto.randomUUID(),
        source: "system",
        event_type: "next.request_error",
        severity: "error",
        module: context.routePath,
        screen_path: request.path,
        api_path: context.routeType === "route" ? request.path : null,
        message: message.slice(0, 2000),
        fingerprint: `next:${context.routeType}:${context.routePath}:${digest ?? message.slice(0, 80)}`,
        metadata: { method: request.method, router_kind: context.routerKind, route_type: context.routeType, digest },
      });
  } catch {
    // Observability must never make an application error worse.
  }
};
