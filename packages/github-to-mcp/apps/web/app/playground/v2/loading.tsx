/**
 * Playground V2 Loading State - Skeleton UI for loading
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

export default function PlaygroundV2Loading() {
  return (
    <main className="relative min-h-screen flex flex-col bg-black">
      {/* Header skeleton */}
      <div className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/80 border-b border-neutral-800">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="h-8 w-32 bg-neutral-800 rounded animate-pulse" />
            <div className="hidden md:flex items-center gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-6 w-20 bg-neutral-800 rounded animate-pulse" />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-24 bg-neutral-800 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-24 pb-8 flex-1 flex flex-col">
        {/* Back link skeleton */}
        <div className="mb-6 flex items-center justify-between">
          <div className="h-5 w-28 bg-neutral-800 rounded animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-20 bg-neutral-800 rounded animate-pulse" />
            <div className="h-8 w-20 bg-neutral-800 rounded animate-pulse" />
          </div>
        </div>

        {/* Page header skeleton */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="h-10 w-56 bg-neutral-800 rounded-full animate-pulse" />
          </div>
          <div className="flex justify-center mb-4">
            <div className="h-12 w-[28rem] bg-neutral-800 rounded animate-pulse" />
          </div>
          <div className="flex justify-center">
            <div className="h-7 w-[36rem] bg-neutral-800 rounded animate-pulse" />
          </div>
        </div>

        {/* Main content grid skeleton */}
        <div className="flex-1 grid gap-6 lg:grid-cols-[1fr,320px]">
          {/* Left panel */}
          <div className="space-y-6">
            {/* Connection section skeleton */}
            <div className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900/50">
              <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                {/* Transport configurator skeleton */}
                <div className="flex-1 space-y-4">
                  <div className="flex gap-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-10 w-28 bg-neutral-800 rounded animate-pulse" />
                    ))}
                  </div>
                  <div className="h-10 bg-neutral-800 rounded animate-pulse" />
                  <div className="h-10 bg-neutral-800 rounded animate-pulse" />
                </div>

                {/* Connection status skeleton */}
                <div className="lg:w-80 p-4 rounded-xl border border-neutral-800 bg-neutral-950/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="h-5 w-24 bg-neutral-800 rounded animate-pulse" />
                    <div className="h-5 w-5 bg-neutral-800 rounded-full animate-pulse" />
                  </div>
                  <div className="h-10 bg-neutral-800 rounded animate-pulse" />
                  <div className="flex gap-2">
                    <div className="h-6 w-16 bg-neutral-800 rounded-full animate-pulse" />
                    <div className="h-6 w-20 bg-neutral-800 rounded-full animate-pulse" />
                  </div>
                </div>
              </div>
            </div>

            {/* Capabilities section skeleton */}
            <div className="min-h-[500px] rounded-2xl border border-neutral-800 bg-neutral-900/50 overflow-hidden">
              {/* Tabs skeleton */}
              <div className="p-4 border-b border-neutral-800">
                <div className="flex gap-1 p-1 rounded-lg bg-neutral-900/50">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-10 w-32 bg-neutral-800 rounded-md animate-pulse" />
                  ))}
                </div>
              </div>

              {/* Content skeleton */}
              <div className="p-4 flex h-[400px]">
                {/* Tool list skeleton */}
                <div className="w-72 border-r border-neutral-800 pr-4 space-y-2">
                  <div className="h-9 bg-neutral-800 rounded animate-pulse" />
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-14 bg-neutral-800 rounded animate-pulse" />
                  ))}
                </div>

                {/* Tool detail skeleton */}
                <div className="flex-1 pl-4 space-y-4">
                  <div className="h-8 w-48 bg-neutral-800 rounded animate-pulse" />
                  <div className="h-4 w-full bg-neutral-800 rounded animate-pulse" />
                  <div className="h-4 w-3/4 bg-neutral-800 rounded animate-pulse" />
                  <div className="space-y-3 mt-6">
                    <div className="h-10 bg-neutral-800 rounded animate-pulse" />
                    <div className="h-10 bg-neutral-800 rounded animate-pulse" />
                    <div className="h-10 bg-neutral-800 rounded animate-pulse" />
                  </div>
                  <div className="h-10 w-28 bg-neutral-800 rounded animate-pulse mt-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Right panel - History skeleton */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl border border-neutral-800 bg-neutral-900/50 overflow-hidden">
              <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
                <div className="h-6 w-36 bg-neutral-800 rounded animate-pulse" />
                <div className="h-6 w-12 bg-neutral-800 rounded animate-pulse" />
              </div>
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 bg-neutral-800 rounded animate-pulse" />
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Footer skeleton */}
      <div className="border-t border-neutral-800 bg-black py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="h-5 w-32 bg-neutral-800 rounded animate-pulse" />
            <div className="flex gap-4">
              <div className="h-5 w-16 bg-neutral-800 rounded animate-pulse" />
              <div className="h-5 w-16 bg-neutral-800 rounded animate-pulse" />
              <div className="h-5 w-16 bg-neutral-800 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
