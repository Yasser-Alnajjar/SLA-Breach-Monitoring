import { IntegrationDetail } from "@modules/settings/integration-detail";

export default async function IntegrationDetailPage({
  params,
}: {
  params: Promise<{ provider: string }>;
}) {
  const { provider } = await params;
  return <IntegrationDetail provider={provider} />;
}
