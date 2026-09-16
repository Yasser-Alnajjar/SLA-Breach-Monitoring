import { Actions } from "@/actions";
import type { ConciergeSourceProvider } from "@/lib/types/concierge-export";
import { ConciergeExportView } from "../csr/ConciergeExportView";

interface ConciergeExportProps {
  provider: ConciergeSourceProvider;
}

export const ConciergeExport = async ({ provider }: ConciergeExportProps) => {
  const data = await Actions.Concierge.getExportData(provider);

  return (
    <ConciergeExportView
      data={{
        provider,
        organizations: data.organizations ?? [],
        initialOrganizationId: data.initialOrganizationId ?? null,
        initialIntegrations: data.initialIntegrations ?? [],
      }}
    />
  );
};
