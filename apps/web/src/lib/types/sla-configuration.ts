import type { CommitmentKind, SLAPolicyMatch } from "@sla/core";

export interface SlaPolicyTarget {
  kind: CommitmentKind;
  minutes: number;
}

export interface SlaPolicySummary {
  id: string;
  name: string;
  imported: boolean;
  version: number;
  effectiveFrom: string;
  match: SLAPolicyMatch;

  /** Targets currently effective for new commitments. */
  targets: SlaPolicyTarget[];

  /** Targets from the original imported policy version. */
  importedTargets: SlaPolicyTarget[];

  /** True when the current targets differ from the original imported targets. */
  overridden: boolean;
}

export interface BusinessCalendarOption {
  id: string;
  name: string;
  alwaysOpen: boolean;
  timezone: string;
}

export interface CustomerCalendarSummary {
  id: string;
  name: string;
  tier: string | null;
  calendarId: string | null;
}

export interface SlaConfigurationData {
  engineeringLegTargetMinutes: number | null;
  slaPolicies: SlaPolicySummary[];
  businessCalendars: BusinessCalendarOption[];
  customerCalendars: CustomerCalendarSummary[];
}
