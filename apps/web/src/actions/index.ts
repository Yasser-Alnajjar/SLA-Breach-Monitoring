import "server-only";
import { DashboardActions } from "./dashboard";
import { CasesActions } from "./cases";
import { OnboardingActions } from "./onboarding";
import { FindingsActions } from "./findings";
import { IntegrationsActions } from "./integrations";
import { SlaConfigurationActions } from "./sla-configuration";

/**
 * Server-only data layer, imported exclusively by `ssr/` (async server)
 * components. Mutations called from `csr/` (client) components go through
 * `@/actions/client` instead — that module stays free of `@sla/db`/next-auth
 * imports so it never gets pulled into the browser bundle.
 */
export const Actions = {
  Dashboard: DashboardActions,
  Cases: CasesActions,
  Onboarding: OnboardingActions,
  Findings: FindingsActions,
  Integrations: IntegrationsActions,
  SlaConfiguration: SlaConfigurationActions,
};
