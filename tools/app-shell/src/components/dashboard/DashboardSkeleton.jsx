export function DashboardSkeleton() {
  return (
    <div className="p-6 bg-white rounded-tl-2xl flex-1 overflow-y-auto animate-pulse space-y-4">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-muted rounded-full shrink-0" />
          <div className="space-y-1.5">
            <div className="h-3 w-32 bg-muted rounded" />
            <div className="h-5 w-56 bg-muted rounded" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-28 bg-muted rounded-md" />
          <div className="h-8 w-44 bg-muted rounded-md" />
        </div>
      </div>

      {/* Row 1: pending tasks rail + quick actions + top clients */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-6 rounded-xl border bg-card p-4 space-y-3">
          <div className="h-4 w-36 bg-muted rounded" />
          <div className="flex gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex-none w-[180px] rounded-xl border bg-card p-3 space-y-2">
                <div className="h-3 w-16 bg-muted rounded" />
                <div className="h-8 w-12 bg-muted rounded" />
                <div className="h-5 w-24 bg-muted rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-3 rounded-xl border bg-card p-4 space-y-2">
          <div className="h-4 w-28 bg-muted rounded" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-muted/50 rounded" />
          ))}
        </div>
        <div className="lg:col-span-3 rounded-xl border bg-card p-4 space-y-2">
          <div className="h-4 w-32 bg-muted rounded" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <div className="h-3 w-24 bg-muted rounded" />
              <div className="h-5 w-24 bg-muted rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Row 2: financial summary + recent sales + collections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-5 rounded-xl border bg-card p-4 space-y-3">
          <div className="h-3 w-20 bg-muted rounded" />
          <div className="h-4 w-48 bg-muted rounded" />
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-12 bg-muted rounded" />
                <div className="h-7 w-20 bg-muted rounded" />
                <div className="h-5 w-28 bg-muted rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-4 rounded-xl border bg-card p-4 space-y-2">
          <div className="h-4 w-32 bg-muted rounded" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <div className="h-3 w-28 bg-muted rounded" />
              <div className="flex gap-1.5">
                <div className="h-5 w-16 bg-muted rounded-full" />
                <div className="h-5 w-16 bg-muted rounded-full" />
              </div>
            </div>
          ))}
        </div>
        <div className="lg:col-span-3 rounded-xl border bg-card p-4 space-y-3">
          <div className="h-4 w-28 bg-muted rounded" />
          <div className="flex items-center justify-between">
            <div className="h-4 w-20 bg-muted rounded" />
            <div className="h-8 w-32 bg-muted rounded-full" />
          </div>
          <div className="flex items-center justify-between">
            <div className="h-4 w-16 bg-muted rounded" />
            <div className="h-8 w-24 bg-muted rounded-full" />
          </div>
        </div>
      </div>

      {/* Row 3: chart + best products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-8 rounded-xl border bg-card p-4 space-y-3">
          <div className="h-4 w-40 bg-muted rounded" />
          <div className="h-48 w-full bg-muted rounded" />
        </div>
        <div className="lg:col-span-4 rounded-xl border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="h-4 w-36 bg-muted rounded" />
            <div className="h-7 w-32 bg-muted rounded-full" />
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <div className="h-3 w-24 bg-muted rounded" />
              <div className="flex gap-1.5">
                <div className="h-5 w-10 bg-muted rounded-full" />
                <div className="h-5 w-16 bg-muted rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
