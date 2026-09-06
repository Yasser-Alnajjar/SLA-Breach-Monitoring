import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getPrismaClient } from "@sla/db";
import type { ZendeskCredentials } from "@sla/zendesk";
import { OnboardingShell } from "@/components/shared/onboarding-shell";
import { authOptions } from "@/lib/auth";
import { getOnboardingStatus } from "@/lib/onboarding-data";
import { OnboardingFlow } from "./onboarding-flow";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/sign-in");

  const prisma = getPrismaClient();
  const [status, zendeskIntegration] = await Promise.all([
    getOnboardingStatus(prisma, session.user.organizationId),
    prisma.integration.findUnique({
      where: { organizationId_provider: { organizationId: session.user.organizationId, provider: "zendesk" } },
    }),
  ]);
  const zendeskCredentials = (zendeskIntegration?.credentials as ZendeskCredentials | null) ?? null;

  return (
    <OnboardingShell title="Getting started" description="Connect your tools — findings show up automatically.">
      <OnboardingFlow initialStatus={status} zendeskSubdomain={zendeskCredentials?.subdomain ?? null} />
    </OnboardingShell>
  );
}
