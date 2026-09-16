"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { ErrorReference, RouteStatus } from "@/components/shared/route-status";
import { Button } from "@/components/ui/button";

/**
 * Keeps the sidebar and header on screen when a page inside the app throws,
 * so the user can navigate away instead of hitting a dead end.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteStatus
      icon={AlertTriangle}
      title="This page couldn't load"
      description={
        <>
          Something went wrong while loading this page. SLA tracking keeps
          running in the background, so no data is lost. Try again, or go
          back to the dashboard.
          <ErrorReference digest={error.digest} />
        </>
      }
      actions={
        <>
          <Button size="sm" onClick={reset}>
            Try again
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </>
      }
    />
  );
}
