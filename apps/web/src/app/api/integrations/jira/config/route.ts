import { createIntegrationConfigHandlers } from "@/lib/integration-config-route";

export const { GET, POST } = createIntegrationConfigHandlers("jira");
