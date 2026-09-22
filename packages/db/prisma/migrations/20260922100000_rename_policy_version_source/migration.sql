-- RenameEnum
-- `PolicyVersionSource` is now shared by SLAPolicyVersion AND
-- BusinessCalendarVersion (Phase 4 task 4.5/4.6), so it's renamed to a name
-- that doesn't say "Policy". The column type reference on
-- sla_policy_versions.source follows automatically (Postgres links by OID).
ALTER TYPE "PolicyVersionSource" RENAME TO "VersionSource";

-- AlterEnum
-- Added in a migration of its own so the new value is committed before any
-- later migration uses it as a column default (Postgres requires a new enum
-- value to be committed before it can be used).
ALTER TYPE "VersionSource" ADD VALUE 'native';

-- CreateEnum
CREATE TYPE "PolicySource" AS ENUM ('imported', 'native');
