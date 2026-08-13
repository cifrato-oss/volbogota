import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder shown while centers load, matching `CentroOption`'s layout. */
export function CentroOptionSkeleton() {
  return (
    <div className="bg-card border-border flex h-full w-full flex-col gap-3 rounded-xl border p-4">
      <div className="space-y-2">
        <Skeleton className="h-5 w-2/5" />
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-4 w-16" />
      <div className="mt-auto grid grid-cols-3 gap-2">
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
      </div>
    </div>
  );
}
