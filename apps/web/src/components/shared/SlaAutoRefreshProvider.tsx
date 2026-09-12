"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL = 5 * 1000;

export function SlaAutoRefreshProvider() {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      router.refresh();
      console.log("refreshed");
    };

    const interval = setInterval(refresh, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [router]);

  return null;
}
