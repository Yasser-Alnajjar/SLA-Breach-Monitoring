-- AlterTable
-- SLAPolicy: source (D12 precedence) + deactivatedAt (task 4.4).
ALTER TABLE "sla_policies" ADD COLUMN     "source" "PolicySource" NOT NULL DEFAULT 'native';
ALTER TABLE "sla_policies" ADD COLUMN     "deactivatedAt" TIMESTAMP(3);

-- Backfill: every pre-Phase-4 policy came from Zendesk.
UPDATE "sla_policies" SET "source" = 'imported' WHERE "externalId" IS NOT NULL;

-- AlterTable
-- BusinessCalendar: source (D12 precedence, mirrors SLAPolicy).
ALTER TABLE "business_calendars" ADD COLUMN     "source" "PolicySource" NOT NULL DEFAULT 'native';

-- Backfill: every pre-Phase-4 calendar with an externalId came from Zendesk;
-- the always-open default calendar (externalId IS NULL) is left 'native'.
UPDATE "business_calendars" SET "source" = 'imported' WHERE "externalId" IS NOT NULL;

-- AlterTable
-- BusinessCalendarVersion: source (closes E-18, task 4.5) + holidayNames
-- (task 4.6). Every pre-Phase-4 version was written by the Zendesk importer.
ALTER TABLE "business_calendar_versions" ADD COLUMN     "source" "VersionSource" NOT NULL DEFAULT 'imported';
ALTER TABLE "business_calendar_versions" ADD COLUMN     "holidayNames" JSONB;

-- AlterTable
-- Organization: default calendar for the native policy/calendar create forms (task 4.7).
ALTER TABLE "organizations" ADD COLUMN     "defaultCalendarId" TEXT;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_defaultCalendarId_fkey" FOREIGN KEY ("defaultCalendarId") REFERENCES "business_calendars"("id") ON DELETE SET NULL ON UPDATE CASCADE;
