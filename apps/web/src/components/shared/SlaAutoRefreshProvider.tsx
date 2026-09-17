"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL = 5 * 1000;

/** Give up waiting on a refresh that never reports back and refresh anyway. */
const MAX_REFRESH_WAIT_MS = 60 * 1000;

export function SlaAutoRefreshProvider({
  initInterval = REFRESH_INTERVAL,
}: {
  initInterval?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    // Each `router.refresh()` supersedes the one still in flight. On a page
    // whose server render takes longer than the interval, unguarded ticks
    // restart it forever and the page never gets past its loading skeleton
    // (roadmap step 41). So skip ticks until the last refresh's RSC response
    // has fully arrived, which the browser reports as a resource timing
    // entry once the body completes. `useTransition` can't serve here: it
    // settles as soon as the layout commits, while a slow segment is still
    // behind its Suspense fallback.
    let pendingSince: number | null = null;

    const observer =
      typeof PerformanceObserver === "undefined"
        ? null
        : new PerformanceObserver((list) => {
            if (pendingSince === null) return;
            const since = pendingSince;
            const settled = list
              .getEntries()
              .some(
                (entry) =>
                  entry.name.includes("_rsc=") && entry.startTime >= since,
              );
            if (settled) pendingSince = null;
          });
    observer?.observe({ type: "resource", buffered: false });

    const refresh = () => {
      if (document.hidden) return;
      const now = performance.now();
      if (
        observer &&
        pendingSince !== null &&
        now - pendingSince < MAX_REFRESH_WAIT_MS
      ) {
        return;
      }
      pendingSince = now;
      router.refresh();
    };

    const interval = setInterval(refresh, initInterval);

    return () => {
      clearInterval(interval);
      observer?.disconnect();
    };
  }, [router, initInterval]);

  return null;
}
