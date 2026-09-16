import { describe, expect, it } from "vitest";
import {
  exportRequest,
  initialSelection,
  integrationsFailed,
  integrationsLoaded,
  selectIntegration,
  selectOrganization,
} from "@/lib/concierge-selection";
import type { ConciergeIntegrationOption } from "@/lib/types/concierge-export";

const orgA = { id: "org-a", name: "Organization A" };
const orgB = { id: "org-b", name: "Organization B" };

function jira(id: string, organizationId: string, overrides: Partial<ConciergeIntegrationOption> = {}): ConciergeIntegrationOption {
  return { id, organizationId, name: `Jira ${id}`, exportable: true, unavailableReason: null, ...overrides };
}

describe("organization selection", () => {
  it("auto-selects the only organization and its only integration", () => {
    const state = initialSelection({
      provider: "jira",
      organizations: [orgA],
      initialOrganizationId: orgA.id,
      initialIntegrations: [jira("jira-a", orgA.id)],
    });
    expect(state.organizationId).toBe(orgA.id);
    expect(state.integrationId).toBe("jira-a");
    expect(exportRequest(state)).toEqual({ organizationId: orgA.id, integrationId: "jira-a" });
  });

  it("leaves the choice open when there are several organizations", () => {
    const state = initialSelection({ provider: "zendesk", organizations: [orgA, orgB], initialOrganizationId: null, initialIntegrations: [] });
    expect(state.organizationId).toBeNull();
    expect(state.integrations).toBeNull();
    expect(exportRequest(state)).toBeNull();
  });

  it("has nothing to select or export with no authorized organizations", () => {
    const state = initialSelection({ provider: "zendesk", organizations: [], initialOrganizationId: null, initialIntegrations: [] });
    expect(state.organizationId).toBeNull();
    expect(exportRequest(state)).toBeNull();
    expect(selectOrganization(state, "org-a")).toBe(state);
  });

  it("ignores an organization id that wasn't offered", () => {
    const state = initialSelection({ provider: "zendesk", organizations: [orgA, orgB], initialOrganizationId: null, initialIntegrations: [] });
    expect(selectOrganization(state, "org-other")).toBe(state);
  });
});

describe("Jira integration selection", () => {
  const picked = selectOrganization(
    initialSelection({ provider: "zendesk", organizations: [orgA, orgB], initialOrganizationId: null, initialIntegrations: [] }),
    orgA.id,
  );

  it("auto-selects a single integration", () => {
    const state = integrationsLoaded(picked, orgA.id, [jira("jira-a", orgA.id)]);
    expect(state.integrationId).toBe("jira-a");
  });

  it("requires a choice between several integrations", () => {
    const state = integrationsLoaded(picked, orgA.id, [jira("jira-1", orgA.id), jira("jira-2", orgA.id)]);
    expect(state.integrations).toHaveLength(2);
    expect(state.integrationId).toBeNull();
    expect(exportRequest(state)).toBeNull();
    const chosen = selectIntegration(state, "jira-2");
    expect(exportRequest(chosen)).toEqual({ organizationId: orgA.id, integrationId: "jira-2" });
  });

  it("shows an empty list and can't export when there are none", () => {
    const state = integrationsLoaded(picked, orgA.id, []);
    expect(state.integrations).toEqual([]);
    expect(exportRequest(state)).toBeNull();
  });

  it("doesn't auto-select or allow a disconnected integration", () => {
    const state = integrationsLoaded(picked, orgA.id, [
      jira("jira-a", orgA.id, { exportable: false, unavailableReason: "Disconnected" }),
    ]);
    expect(state.integrationId).toBeNull();
    expect(selectIntegration(state, "jira-a").integrationId).toBeNull();
  });

  it("drops integrations that belong to another organization", () => {
    const state = integrationsLoaded(picked, orgA.id, [jira("jira-b", orgB.id)]);
    expect(state.integrations).toEqual([]);
  });

  it("surfaces a load failure without a selection", () => {
    const state = integrationsFailed(picked, orgA.id, "boom");
    expect(state.integrationsError).toBe("boom");
    expect(exportRequest(state)).toBeNull();
  });
});

describe("organization switching", () => {
  const start = integrationsLoaded(
    selectOrganization(initialSelection({ provider: "zendesk", organizations: [orgA, orgB], initialOrganizationId: null, initialIntegrations: [] }), orgA.id),
    orgA.id,
    [jira("jira-a", orgA.id)],
  );

  it("clears the integration and reloads for the new organization", () => {
    const switched = selectOrganization(start, orgB.id);
    expect(switched.organizationId).toBe(orgB.id);
    expect(switched.integrations).toBeNull();
    expect(switched.integrationId).toBeNull();
    expect(switched.loadingIntegrations).toBe(true);
    expect(exportRequest(switched)).toBeNull();

    const loaded = integrationsLoaded(switched, orgB.id, [jira("jira-b", orgB.id)]);
    expect(exportRequest(loaded)).toEqual({ organizationId: orgB.id, integrationId: "jira-b" });
  });

  it("never pairs the previous organization's integration with the new organization", () => {
    const switched = selectOrganization(start, orgB.id);
    // A late reply for org A arrives after the switch: it's ignored.
    const late = integrationsLoaded(switched, orgA.id, [jira("jira-a", orgA.id)]);
    expect(late).toBe(switched);
    expect(exportRequest(late)).toBeNull();
    // Even a forced stale id can't be exported: it's not in org B's list.
    const loaded = integrationsLoaded(switched, orgB.id, [jira("jira-b1", orgB.id), jira("jira-b2", orgB.id)]);
    expect(exportRequest({ ...loaded, integrationId: "jira-a" })).toBeNull();
    expect(selectIntegration(loaded, "jira-a").integrationId).toBeNull();
  });
});
