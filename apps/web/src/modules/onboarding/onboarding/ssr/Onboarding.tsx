import { Actions } from "@/actions";
import { OnboardingFlow } from "../csr/OnboardingFlow";
import { OnboardingShell } from "@/components/shared/onboarding-shell";

export const Onboarding = async () => {
  const { status, zendeskSubdomain } = await Actions.Onboarding.getData();

  return (
    <OnboardingShell
      title="Getting started"
      description="Connect your tools — findings show up automatically."
    >
      <OnboardingFlow
        initialStatus={status}
        zendeskSubdomain={zendeskSubdomain}
      />
    </OnboardingShell>
  );
};
