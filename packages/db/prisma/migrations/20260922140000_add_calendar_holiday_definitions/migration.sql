-- AlterTable
-- BusinessCalendarVersion: holidayDefinitions (4h) — the native calendar
-- editor's original `{ date, name, recurring }[]` holiday inputs, kept
-- separate from the flat, expanded `holidays`/`holidayNames` the engine
-- reads, so reopening the editor can tell a recurring holiday apart from a
-- one-off one instead of only ever seeing generated one-off dates. Nullable
-- and additive: null for every existing version (no backfill possible —
-- the original recurring/one-off distinction was never persisted before
-- this fix) and for every Zendesk-imported version (no recurrence concept).
ALTER TABLE "business_calendar_versions" ADD COLUMN     "holidayDefinitions" JSONB;
