import { SearchX } from "lucide-react";
import Link from "next/link";
import { RouteStatus } from "@/components/shared/route-status";
import { Button } from "@/components/ui/button";

/** Rendered inside the app shell when a page calls `notFound()` (an unknown case ID or integration provider). */
export default function AppNotFound() {
  return (
    <RouteStatus
      icon={SearchX}
      title="Not found"
      description="This case or page doesn't exist, or it belongs to a different organization."
      actions={
        <>
          <Button size="sm" asChild>
            <Link href="/cases">All cases</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </>
      }
    />
  );
}
