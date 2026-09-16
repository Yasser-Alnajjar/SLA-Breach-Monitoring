"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { ErrorReference, RouteStatus } from "@/components/shared/route-status";
import { Button } from "@/components/ui/button";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteStatus
      standalone
      icon={AlertTriangle}
      title="Something went wrong"
      description={
        <>
          An unexpected error stopped this page from loading. Try again, or
          head back home.
          <ErrorReference digest={error.digest} />
        </>
      }
      actions={
        <>
          <Button size="sm" onClick={reset}>
            Try again
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/">Go home</Link>
          </Button>
        </>
      }
    />
  );
}
