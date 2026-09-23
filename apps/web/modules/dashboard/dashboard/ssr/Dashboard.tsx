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
  const [data, worker, integrations] = await Promise.all([
    Actions.Dashboard.getData(),
    Actions.WorkerSettings.getData(),
    Actions.Integrations.getData(),
  ]);

  return (
    <>
      <DashboardView
        data={data}
        autoSyncSeconds={Math.round(worker.activePollIntervalMs / 1000)}
        sourceStatus={{
          zendesk: integrations.zendesk.connected,
          jira: integrations.jira.connected,
        }}
      />
      <SlaAutoRefreshProvider
        initInterval={worker.activePollIntervalMs - 2000}
      />
    </>
  );
};
