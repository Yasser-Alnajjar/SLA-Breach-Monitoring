-- AlterTable
-- SLAPolicyVersion: calendarIsExplicit (4i) — whether a calendar was
-- explicitly chosen for this version, distinct from calendarVersionId
-- (which always holds a concrete, usable version). `NOT NULL DEFAULT true`
-- at the database level (not only in Prisma Client) means every existing
-- row, and any row written without knowing this column exists at all
-- (direct inserts, test fixtures, future migrations), is automatically
-- treated as "explicit" — the same, unchanged calendar-pinning behavior
-- every policy had before this fix. Only createNativePolicy/
-- updateNativePolicy ever write `false`, and only when the caller
-- explicitly leaves the calendar unset — the resolution order (explicit >
-- org default > Always Open) needs that distinction at commitment-creation
-- time.
ALTER TABLE "sla_policy_versions" ADD COLUMN     "calendarIsExplicit" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
-- Customer: calendarVersionId (4d) — freezes the customer's calendar
-- override to the specific version that was current when it was assigned,
-- consistent with how a policy pins to a specific calendar version instead
-- of silently following the calendar's latest edits. Kept in lockstep with
-- the existing `calendarId` (set/cleared together by setCustomerCalendar).
ALTER TABLE "customers" ADD COLUMN     "calendarVersionId" TEXT;

-- Backfill: pin every existing customer override to whatever is currently
-- that calendar's latest version — a one-time freeze from this point
-- forward; it does not change any already-created commitment, only which
-- calendar version a *future* commitment resolves through this customer's
-- override.
UPDATE "customers" c
SET "calendarVersionId" = (
  SELECT bcv.id FROM "business_calendar_versions" bcv
  WHERE bcv."calendarId" = c."calendarId"
  ORDER BY bcv.version DESC
  LIMIT 1
)
WHERE c."calendarId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_calendarVersionId_fkey" FOREIGN KEY ("calendarVersionId") REFERENCES "business_calendar_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
