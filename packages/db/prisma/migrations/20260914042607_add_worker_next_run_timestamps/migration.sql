-- AlterTable
ALTER TABLE "worker_settings" ADD COLUMN     "nextActivePollAt" TIMESTAMP(3),
ADD COLUMN     "nextReconciliationAt" TIMESTAMP(3);
