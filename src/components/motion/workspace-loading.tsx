import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const METRIC_SKELETONS = ["metric-incidents", "metric-documents", "metric-actions", "metric-activity"];
const TABLE_SKELETONS = ["row-primary", "row-secondary", "row-tertiary", "row-quaternary", "row-fifth", "row-sixth"];

export function WorkspaceLoading({ compact = false }: Readonly<{ compact?: boolean }>) {
  return (
    <div className="gerimmo-page-enter space-y-5" role="status" aria-label="Chargement de la page" aria-busy="true">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72 max-w-[70vw]" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>
      <div className={cn("grid gap-3", compact ? "grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 xl:grid-cols-4")}>
        {METRIC_SKELETONS.map((key) => (
          <div key={key} className="rounded-lg border bg-card p-4">
            <Skeleton className="mb-5 h-4 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-5 flex items-center justify-between gap-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="space-y-3">
          {TABLE_SKELETONS.slice(0, compact ? 4 : 6).map((key) => (
            <div key={key} className="grid grid-cols-[2fr_1fr_1fr] gap-4 border-t pt-3 first:border-0 first:pt-0">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
