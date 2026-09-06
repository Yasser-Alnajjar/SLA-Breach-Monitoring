-- AlterTable
ALTER TABLE "business_calendars" ADD COLUMN     "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "business_calendars_organizationId_externalId_key" ON "business_calendars"("organizationId", "externalId");

