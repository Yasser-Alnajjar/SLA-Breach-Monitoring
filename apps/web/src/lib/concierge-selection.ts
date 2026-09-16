import type {
  ConciergeExportPageData,
  ConciergeExportSelectionRequest,
  ConciergeIntegrationOption,
  ConciergeOrganizationOption,
} from "./types/concierge-export";

/**
 * Selection state for the Concierge export pages, kept free of React so
 * the rules (auto-select a single option, clear the integration when the
 * organization changes, ignore responses for an organization no longer
 * selected) are testable on their own.
 */
export interface ConciergeExportSelection {
  organizations: ConciergeOrganizationOption[];
  organizationId: string | null;
  /** Null until the selected organization's integrations have loaded. */
  integrations: ConciergeIntegrationOption[] | null;
  integrationId: string | null;
  loadingIntegrations: boolean;
  integrationsError: string | null;
}

export function initialSelection(data: ConciergeExportPageData): ConciergeExportSelection {
  const state: ConciergeExportSelection = {
    organizations: data.organizations,
    organizationId: data.organizations.length === 1 ? data.organizations[0]!.id : null,
    integrations: null,
    integrationId: null,
    loadingIntegrations: false,
    integrationsError: null,
  };
  if (state.organizationId && data.initialOrganizationId === state.organizationId) {
    return integrationsLoaded(state, state.organizationId, data.initialIntegrations);
  }
  return state;
}

/** Switching organization drops the previous integration list and choice before anything loads. */
export function selectOrganization(state: ConciergeExportSelection, organizationId: string): ConciergeExportSelection {
  if (!state.organizations.some((organization) => organization.id === organizationId)) return state;
  if (organizationId === state.organizationId && state.integrations !== null) return state;
  return {
    ...state,
    organizationId,
    integrations: null,
    integrationId: null,
    loadingIntegrations: true,
    integrationsError: null,
  };
}

/** A response for an organization that is no longer selected is discarded. */
export function integrationsLoaded(
  state: ConciergeExportSelection,
  organizationId: string,
  integrations: ConciergeIntegrationOption[],
): ConciergeExportSelection {
  if (organizationId !== state.organizationId) return state;
  const own = integrations.filter((integration) => integration.organizationId === organizationId);
  const exportable = own.filter((integration) => integration.exportable);
  return {
    ...state,
    integrations: own,
    integrationId: exportable.length === 1 && own.length === 1 ? exportable[0]!.id : null,
    loadingIntegrations: false,
    integrationsError: null,
  };
}

export function integrationsFailed(state: ConciergeExportSelection, organizationId: string, error: string): ConciergeExportSelection {
  if (organizationId !== state.organizationId) return state;
  return { ...state, integrations: null, integrationId: null, loadingIntegrations: false, integrationsError: error };
}

export function selectIntegration(state: ConciergeExportSelection, integrationId: string): ConciergeExportSelection {
  const integration = state.integrations?.find((candidate) => candidate.id === integrationId);
  if (!integration || !integration.exportable) return state;
  return { ...state, integrationId };
}

/**
 * The request to send, or null while either id is unresolved. The integration
 * must be in the list loaded for the currently selected organization, so a
 * choice left over from a previous organization can never be submitted.
 */
export function exportRequest(state: ConciergeExportSelection): ConciergeExportSelectionRequest | null {
  if (!state.organizationId || !state.integrationId || state.loadingIntegrations) return null;
  const integration = state.integrations?.find((candidate) => candidate.id === state.integrationId);
  if (!integration || integration.organizationId !== state.organizationId || !integration.exportable) return null;
  return { organizationId: state.organizationId, integrationId: integration.id };
}
