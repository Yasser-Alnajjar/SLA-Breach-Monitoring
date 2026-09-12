-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "calendarId" TEXT;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "business_calendars"("id") ON DELETE SET NULL ON UPDATE CASCADE;
