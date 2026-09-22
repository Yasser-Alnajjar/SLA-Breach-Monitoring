import type { CommitmentKind, SLAPolicyMatch, WeeklyWindow } from "@sla/core";
import type { NativeHolidayInput } from "@sla/commitments";

export interface SlaPolicyTarget {
  kind: CommitmentKind;
  minutes: number;
}

export interface SlaPolicySummary {
  id: string;
  name: string;
  /** `imported` (Zendesk, read-only, target overrides only) or `native` (created in Watchtower, fully editable) — D12/Phase 4. */
  source: "imported" | "native";
  /** False only for a deactivated native policy (task 4.4) or an archived (Zendesk-deleted) imported policy. Excluded from matching either way. */
  active: boolean;
  version: number;
  effectiveFrom: string;
  createdAt: string;
  match: SLAPolicyMatch;
  calendarId: string;
  /** True when no calendar was explicitly chosen for this policy — its commitments resolve to the organization's default calendar (or Always Open) fresh, at creation time, rather than the frozen `calendarId` above (4i). */
  usesOrganizationDefaultCalendar: boolean;
  warnAtPercent: number[];

  /** Targets currently effective for new commitments. */
  targets: SlaPolicyTarget[];

  /**
   * Targets from the policy's baseline version — the latest *imported*
   * version for an imported policy (so a Zendesk-side change shows as the
   * new baseline), or the very first version for a native policy (which has
   * no imported version at all).
   */
  importedTargets: SlaPolicyTarget[];

  /** True when the current targets differ from the baseline targets above. */
  overridden: boolean;
}

export interface BusinessCalendarOption {
  id: string;
  name: string;
  source: "imported" | "native";
  alwaysOpen: boolean;
  timezone: string;
  createdAt: string;
  /** Current version's working hours — always the flat, non-recurring shape the engine reads; a re-edit of a recurring holiday re-expands from scratch. */
  weekly: WeeklyWindow[];
  holidays: NativeHolidayInput[];
}

export interface CustomerCalendarSummary {
  id: string;
  name: string;
  tier: string | null;
  calendarId: string | null;
}

export interface SlaConfigurationData {
  engineeringLegTargetMinutes: number | null;
  /** Pre-filled calendar choice when creating a native policy/calendar (task 4.7). Not part of runtime calendar resolution. */
  defaultCalendarId: string | null;
  slaPolicies: SlaPolicySummary[];
  businessCalendars: BusinessCalendarOption[];
  customerCalendars: CustomerCalendarSummary[];
}
