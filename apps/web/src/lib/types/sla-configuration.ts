import type { CommitmentKind, SLAPolicyMatch } from "@sla/core";

export interface SlaPolicySummary {
  id: string;
  name: string;
  /** Non-null `SLAPolicy.externalId` means it was imported from Zendesk rather than created manually. */
  imported: boolean;
  version: number;
  effectiveFrom: string;
  match: SLAPolicyMatch;
  targets: { kind: CommitmentKind; minutes: number }[];
}

/** One `BusinessCalendar` an org already has (imported from Zendesk, or the always-open default) — selectable as a customer's override (roadmap step 24). */
export interface BusinessCalendarOption {
  id: string;
  name: string;
  alwaysOpen: boolean;
  timezone: string;
}

/** A customer and its current calendar override, if any, for the settings picker (roadmap step 24). */
export interface CustomerCalendarSummary {
  id: string;
  name: string;
  tier: string | null;
  calendarId: string | null;
}

/**
 * Read model for `/settings/sla/configuration`: the org-wide SLA engine
 * settings — engineering leg target, per-policy target overrides, and
 * per-customer calendar overrides — as opposed to provider connection state,
 * which lives in `IntegrationsPageData` instead.
 */
export interface SlaConfigurationData {
  engineeringLegTargetMinutes: number | null;
  slaPolicies: SlaPolicySummary[];
  businessCalendars: BusinessCalendarOption[];
  customerCalendars: CustomerCalendarSummary[];
}
