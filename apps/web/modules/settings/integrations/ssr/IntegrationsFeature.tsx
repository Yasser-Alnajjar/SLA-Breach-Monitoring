import { Actions } from "@/actions";
import { AppShell } from "@/components/layout/app-shell";
import { IntegrationsView } from "../csr/IntegrationsView";

/**
 * `AppShell` is itself an async server component (it reads the session
 * directly for the user menu), so it's composed here rather than inside the
 * "use client" view — nesting it in the CSR layer would drag `@sla/db` into
 * the browser bundle.
 */
export const IntegrationsFeature = async () => {
  const data = await Actions.Integrations.getData();
  return (
    <AppShell title="Integrations">
      <IntegrationsView data={data} />
    </AppShell>
  );
};
