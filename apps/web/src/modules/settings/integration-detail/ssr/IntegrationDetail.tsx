import { Actions } from "@/actions";
import { IntegrationDetailView } from "../csr/IntegrationDetailView";

export const IntegrationDetail = async ({ provider }: { provider: string }) => {
  const data = await Actions.Integrations.getDetail(provider);
  return <IntegrationDetailView data={data} />;
};
