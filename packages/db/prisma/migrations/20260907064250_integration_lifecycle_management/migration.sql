-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('connected', 'disconnected', 'reauth_required');

-- AlterTable
ALTER TABLE "integrations" ADD COLUMN     "disconnectedAt" TIMESTAMP(3),
ADD COLUMN     "lastSyncAt" TIMESTAMP(3),
ADD COLUMN     "lastSyncError" TEXT,
ADD COLUMN     "status" "IntegrationStatus" NOT NULL DEFAULT 'connected';
