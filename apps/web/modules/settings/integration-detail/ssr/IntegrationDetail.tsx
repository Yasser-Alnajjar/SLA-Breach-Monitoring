import { Actions } from "@/actions";
import { AppShell } from "@/components/layout/app-shell";
import { INTEGRATION_PROVIDER_LABELS } from "@/lib/types/integrations";
import { IntegrationDetailView } from "../csr/IntegrationDetailView";

export const IntegrationDetail = async ({ provider }: { provider: string }) => {
  const data = await Actions.Integrations.getDetail(provider);
  return (
    <AppShell title={INTEGRATION_PROVIDER_LABELS[data.provider]}>
      <IntegrationDetailView data={data} />
    </AppShell>
  );
};
