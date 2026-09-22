-- Repairs drift on any database that already ran an earlier version of
-- 20260922130000_add_calendar_pinning_4d_4i (the migration was edited in
-- place, after already being applied, to rename SLAPolicyVersion's
-- explicit-calendar column from `explicitCalendarId` (text, nullable FK) to
-- `calendarIsExplicit` (boolean, default true) — see 4i). Idempotent and
-- safe everywhere: a no-op on any database that already has the corrected
-- schema (a fresh install, or one that only ever ran the current migration
-- file), and the real fix on one that ran the old content. Faithfully
-- converts existing data instead of defaulting it: a row that had an
-- explicit calendar keeps `calendarIsExplicit = true`; a row that had none
-- becomes `false`, preserving its already-configured "use organization
-- default" behavior.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sla_policy_versions' AND column_name = 'calendarIsExplicit'
  ) THEN
    ALTER TABLE "sla_policy_versions" ADD COLUMN "calendarIsExplicit" BOOLEAN NOT NULL DEFAULT true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sla_policy_versions' AND column_name = 'explicitCalendarId'
  ) THEN
    UPDATE "sla_policy_versions" SET "calendarIsExplicit" = ("explicitCalendarId" IS NOT NULL);
    ALTER TABLE "sla_policy_versions" DROP CONSTRAINT IF EXISTS "sla_policy_versions_explicitCalendarId_fkey";
    ALTER TABLE "sla_policy_versions" DROP COLUMN "explicitCalendarId";
  END IF;
END $$;
