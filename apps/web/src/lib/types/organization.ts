/** Mirrors `GET/PATCH /api/settings/organization`'s response shape (roadmap 5.8). */
export interface OrganizationSettingsData {
  name: string;
  /** IANA time zone id — display-only, see `@/lib/organization-settings`. */
  timezone: string;
  /** Whether the signed-in user can change these settings (organization owner) — view-only for everyone else. */
  canEdit: boolean;
}
