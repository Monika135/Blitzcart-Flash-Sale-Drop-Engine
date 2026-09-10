export default function Skeleton({ className = '' }) {
  return (
    <div
      className={`animate-pulse rounded bg-base-line/70 ${className}`}
      aria-hidden="true"
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="glass-panel w-full max-w-5xl rounded-3xl overflow-hidden">
      <Skeleton className="h-64 w-full rounded-none md:h-[570px]" />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 pr-3">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-10" />
        </div>
        <Skeleton className="h-7 w-full mb-2" />
        <Skeleton className="h-1.5 w-full mb-4" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}
