-- CreateTable
CREATE TABLE "commitment_policy_changes" (
    "id" TEXT NOT NULL,
    "commitmentId" TEXT NOT NULL,
    "previousPolicyVersionId" TEXT NOT NULL,
    "newPolicyVersionId" TEXT NOT NULL,
    "previousTargetMinutes" INTEGER NOT NULL,
    "newTargetMinutes" INTEGER NOT NULL,
    "previousCalendarVersionId" TEXT NOT NULL,
    "newCalendarVersionId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commitment_policy_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commitment_policy_changes_commitmentId_changedAt_idx" ON "commitment_policy_changes"("commitmentId", "changedAt");

-- AddForeignKey
ALTER TABLE "commitment_policy_changes" ADD CONSTRAINT "commitment_policy_changes_commitmentId_fkey" FOREIGN KEY ("commitmentId") REFERENCES "commitments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
