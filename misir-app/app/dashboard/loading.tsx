import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-1 flex-col gap-8 p-8 pt-10">
      <div className="flex flex-col items-center gap-2 text-center mb-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="flex flex-col items-center gap-12">
        {/* Daylight cycle skeleton */}
        <Skeleton className="h-75 w-75 rounded-full" />
        
        {/* Digestion queue skeleton */}
        <div className="w-full max-w-md space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
