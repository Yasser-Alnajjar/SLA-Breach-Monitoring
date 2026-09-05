-- DropIndex
DROP INDEX "commitments_caseId_idx";

-- AlterTable
ALTER TABLE "sla_policies" ADD COLUMN     "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "commitments_caseId_kind_key" ON "commitments"("caseId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "sla_policies_organizationId_externalId_key" ON "sla_policies"("organizationId", "externalId");
