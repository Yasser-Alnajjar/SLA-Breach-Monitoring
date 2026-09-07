import { Download } from "lucide-react";
import { Actions } from "@/actions";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { DashboardView } from "../csr/DashboardView";

/**
 * `AppShell` is itself an async server component (it reads the session
 * directly for the user menu), so it's composed here rather than inside the
 * "use client" view — nesting it in the CSR layer would drag `@sla/db` into
 * the browser bundle.
 */
export const DashboardFeature = async () => {
  const data = await Actions.Dashboard.getData();
  return (
    <AppShell
      title="Dashboard"
      actions={
        <Button variant="outline" size="sm" asChild>
          <a href="/api/reports/commitments">
            <Download />
            Export CSV
          </a>
        </Button>
      }
    >
      <DashboardView data={data} />
    </AppShell>
  );
};
