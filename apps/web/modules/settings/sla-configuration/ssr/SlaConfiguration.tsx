import { Actions } from "@/actions";
import { AppShell } from "@/components/layout/app-shell";
import { SlaConfigurationView } from "../csr/SlaConfigurationView";

/**
 * `AppShell` is itself an async server component (it reads the session
 * directly for the user menu), so it's composed here rather than inside the
 * "use client" view — nesting it in the CSR layer would drag `@sla/db` into
 * the browser bundle.
 */
export const SlaConfiguration = async () => {
  const data = await Actions.SlaConfiguration.getData();

  return (
    <AppShell title="SLA Configuration">
      <SlaConfigurationView data={data} />
    </AppShell>
  );
};
