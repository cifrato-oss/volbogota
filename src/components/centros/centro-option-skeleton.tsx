import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder shown while centers load, matching `CentroOption`'s layout. */
export function CentroOptionSkeleton() {
  return (
    <div className="bg-card border-border h-full w-full rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="w-full space-y-2">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
        <Skeleton className="size-5 rounded-full" />
      </div>
      <div className="mt-3 flex gap-1.5">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-3 w-24" />
    </div>
  );
}
