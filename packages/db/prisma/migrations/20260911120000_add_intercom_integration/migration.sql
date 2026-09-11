-- AlterEnum
ALTER TYPE "IntegrationProvider" ADD VALUE 'intercom';

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "intercomCompanyId" TEXT;

-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "system" "IntegrationProvider" NOT NULL DEFAULT 'zendesk';

-- CreateIndex
CREATE UNIQUE INDEX "customers_organizationId_intercomCompanyId_key" ON "customers"("organizationId", "intercomCompanyId");
