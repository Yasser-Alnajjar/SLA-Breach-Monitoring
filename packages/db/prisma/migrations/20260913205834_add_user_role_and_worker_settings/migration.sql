-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'member');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'member';

-- Backfill: every organization created before this migration must already
-- have exactly one owner able to reach the new admin-only Monitoring
-- settings page. Sign-up is still the only path that creates a `User` row
-- (no invite flow yet), so the earliest-created user in each organization
-- is that organization's creator.
UPDATE "users" u
SET "role" = 'owner'
WHERE u.id = (
  SELECT u2.id FROM "users" u2
  WHERE u2."organizationId" = u."organizationId"
  ORDER BY u2."createdAt" ASC, u2.id ASC
  LIMIT 1
);

-- CreateTable
CREATE TABLE "worker_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "activePollIntervalMs" INTEGER NOT NULL,
    "reconciliationIntervalMs" INTEGER NOT NULL,
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastActivePollAt" TIMESTAMP(3),
    "lastActivePollFailures" INTEGER,
    "lastReconciliationAt" TIMESTAMP(3),
    "lastReconciliationFailures" INTEGER,

    CONSTRAINT "worker_settings_pkey" PRIMARY KEY ("id")
);
