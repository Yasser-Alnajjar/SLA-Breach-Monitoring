import type { BusinessCalendarVersion, WeeklyWindow } from "@sla/core";

/** Maps a persisted BusinessCalendarVersion row to packages/core's pure `BusinessCalendarVersion`. Shared by every pipeline/resolution module that reads calendar versions off Prisma rows. */
export function toCalendarVersionDomain(row: {
  id: string;
  version: number;
  timezone: string;
  weekly: unknown;
  holidays: string[];
  alwaysOpen: boolean;
}): BusinessCalendarVersion {
  return {
    id: row.id,
    version: row.version,
    timezone: row.timezone,
    weekly: row.weekly as WeeklyWindow[],
    holidays: row.holidays,
    alwaysOpen: row.alwaysOpen,
  };
}
