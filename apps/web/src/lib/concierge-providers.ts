import { DEFAULT_EXPORT_SINCE_DAYS, type ConciergeSourceProvider } from "./types/concierge-export";

/** Per-provider wording and routes for the Concierge export pages. */
export interface ConciergeProviderCopy {
  label: string;
  title: string;
  exportHref: string;
  integrationHref: string;
  sourceDescription: string;
  exportButton: string;
  recordNoun: string;
  historyNoun: string;
}

export const CONCIERGE_PROVIDER_COPY: Record<ConciergeSourceProvider, ConciergeProviderCopy> = {
  jira: {
    label: "Jira",
    title: "Jira Concierge Export",
    exportHref: "/internal/concierge/jira-export",
    integrationHref: "/settings/integrations/jira",
    sourceDescription: `Issues updated in the last ${DEFAULT_EXPORT_SINCE_DAYS} days, with their status history from Jira's changelog.`,
    exportButton: "Export Jira Concierge Data",
    recordNoun: "Jira issues",
    historyNoun: "changelog entries",
  },
  zendesk: {
    label: "Zendesk",
    title: "Zendesk Concierge Export",
    exportHref: "/internal/concierge/zendesk-export",
    integrationHref: "/settings/integrations/zendesk",
    sourceDescription: `Tickets updated in the last ${DEFAULT_EXPORT_SINCE_DAYS} days, with their status changes from Zendesk's ticket audits.`,
    exportButton: "Export Zendesk Concierge Data",
    recordNoun: "Zendesk tickets",
    historyNoun: "status changes",
  },
};
