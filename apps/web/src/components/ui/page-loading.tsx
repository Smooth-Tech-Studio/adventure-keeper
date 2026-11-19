import { Skeleton } from "@/components/ui/skeleton";

/** Container-less list placeholder: a heading block + `rows` line items. */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Container-less detail placeholder: a heading block + two panels. */
export function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

/** Full-page fallback (own container) for route-level `Suspense`. */
export function PageLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <DetailSkeleton />
    </div>
  );
}
