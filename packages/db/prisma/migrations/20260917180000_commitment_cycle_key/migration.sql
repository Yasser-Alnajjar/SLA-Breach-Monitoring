-- Multiple commitments of one kind per case: Next Reply has one commitment
-- per reply cycle. Existing rows are all single-cycle kinds and take the
-- "single" key, so the old (caseId, kind) uniqueness carries over unchanged.
ALTER TYPE "CommitmentKind" ADD VALUE 'next_reply';

ALTER TABLE "commitments" ADD COLUMN "cycleKey" TEXT NOT NULL DEFAULT 'single';

-- DropIndex
DROP INDEX "commitments_caseId_kind_key";

-- CreateIndex
CREATE UNIQUE INDEX "commitments_caseId_kind_cycleKey_key" ON "commitments"("caseId", "kind", "cycleKey");
