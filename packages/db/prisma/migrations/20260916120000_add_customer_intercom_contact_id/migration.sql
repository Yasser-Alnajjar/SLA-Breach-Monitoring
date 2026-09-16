-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "intercomContactId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "customers_organizationId_intercomContactId_key" ON "customers"("organizationId", "intercomContactId");
