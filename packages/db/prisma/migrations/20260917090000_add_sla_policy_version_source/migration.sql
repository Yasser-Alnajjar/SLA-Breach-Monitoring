-- CreateEnum
CREATE TYPE "PolicyVersionSource" AS ENUM ('imported', 'override');

-- AlterTable
ALTER TABLE "sla_policy_versions" ADD COLUMN     "source" "PolicyVersionSource" NOT NULL DEFAULT 'imported';
