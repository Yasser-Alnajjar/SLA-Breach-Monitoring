"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL = 5 * 1000;

export function SlaAutoRefreshProvider({
  initInterval = REFRESH_INTERVAL,
}: {
  initInterval?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      router.refresh();
      console.log(
        "data updated at ->",
        new Date(Date.now()).toLocaleTimeString(),
      );
    };

    const interval = setInterval(refresh, initInterval);

    return () => clearInterval(interval);
  }, [router]);

  return null;
}
