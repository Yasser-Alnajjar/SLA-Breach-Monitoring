-- CreateTable
CREATE TABLE "sla_import_summaries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "unsupportedConditions" INTEGER NOT NULL DEFAULT 0,
    "unsupportedMetrics" INTEGER NOT NULL DEFAULT 0,
    "policiesWithNoUsableTargets" INTEGER NOT NULL DEFAULT 0,
    "policiesWithUnresolvedSchedule" INTEGER NOT NULL DEFAULT 0,
    "policiesArchived" INTEGER NOT NULL DEFAULT 0,
    "casesWithNoMatchingPolicy" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_import_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sla_import_summaries_organizationId_key" ON "sla_import_summaries"("organizationId");

-- AddForeignKey
ALTER TABLE "sla_import_summaries" ADD CONSTRAINT "sla_import_summaries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
