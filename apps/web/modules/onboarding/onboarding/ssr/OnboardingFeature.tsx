import { OnboardingShell } from "@/components/shared/onboarding-shell";
import { Actions } from "@/actions";
import { OnboardingFlow } from "../csr/OnboardingFlow";

export const OnboardingFeature = async () => {
  const { status, zendeskSubdomain } = await Actions.Onboarding.getData();

  return (
    <OnboardingShell title="Getting started" description="Connect your tools — findings show up automatically.">
      <OnboardingFlow initialStatus={status} zendeskSubdomain={zendeskSubdomain} />
    </OnboardingShell>
  );
};
