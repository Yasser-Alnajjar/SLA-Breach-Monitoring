import { Actions } from "@/actions";

import { DashboardView } from "../csr/DashboardView";
import { SlaAutoRefreshProvider } from "@/components/shared/SlaAutoRefreshProvider";

/**
 * `AppShell` is itself an async server component (it reads the session
 * directly for the user menu), so it's composed here rather than inside the
 * "use client" view — nesting it in the CSR layer would drag `@sla/db` into
 * the browser bundle.
 */
export const Dashboard = async () => {
  const data = await Actions.Dashboard.getData();
  const worker = await Actions.WorkerSettings.getData();

  return (
    <>
      <DashboardView data={data} />
      <SlaAutoRefreshProvider
        initInterval={worker.activePollIntervalMs - 2000}
      />
    </>
  );
};
