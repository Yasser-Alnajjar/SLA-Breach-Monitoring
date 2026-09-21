import { Actions } from "@/actions";

import { SlaAutoRefreshProvider } from "@/components/shared/SlaAutoRefreshProvider";
import { AtRiskView } from "../csr/AtRiskView";

/**
 * `AppShell` is itself an async server component (it reads the session
 * directly for the user menu), so it's composed here rather than inside the
 * "use client" view — nesting it in the CSR layer would drag `@sla/db` into
 * the browser bundle.
 */
export const AtRisk = async () => {
  const data = await Actions.AtRisk.getData();
  const worker = await Actions.WorkerSettings.getData();

  return (
    <>
      <AtRiskView data={data} />
      <SlaAutoRefreshProvider
        initInterval={worker.activePollIntervalMs - 2000}
      />
    </>
  );
};
