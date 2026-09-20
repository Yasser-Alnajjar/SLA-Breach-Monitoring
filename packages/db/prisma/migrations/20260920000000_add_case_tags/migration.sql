-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
