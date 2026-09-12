import { Actions } from "@/actions";

import { IntegrationsView } from "../csr/IntegrationsView";

/**
 * `AppShell` is itself an async server component (it reads the session
 * directly for the user menu), so it's composed here rather than inside the
 * "use client" view — nesting it in the CSR layer would drag `@sla/db` into
 * the browser bundle.
 */
export const Integrations = async () => {
  const data = await Actions.Integrations.getData();

  return <IntegrationsView data={data} />;
};
