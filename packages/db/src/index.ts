import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
export * from "../generated/prisma/client";
export { deriveEncryptionKey, aesGcmEncrypt, aesGcmDecrypt } from "./crypto";
export {
  isConfigurableIntegrationProvider,
  getIntegrationConfig,
  getIntegrationConfigStatus,
  saveIntegrationConfig,
  encryptSecret,
  decryptSecret,
  IntegrationConfigUnreadableError,
} from "./integration-config";
export type {
  ConfigurableIntegrationProvider,
  IntegrationOAuthCredentials,
  IntegrationConfigStatus,
} from "./integration-config";
export {
  isEncryptedToken,
  encryptToken,
  decryptToken,
  encryptCredentials,
  decryptCredentials,
  IntegrationCredentialsUnreadableError,
} from "./integration-credentials";
export {
  getEmailSettings,
  getEmailSettingsStatus,
  saveEmailSettings,
  encryptSmtpPassword,
  decryptSmtpPassword,
  EmailSettingsUnreadableError,
} from "./email-settings";
export type {
  EmailSecurity,
  EmailSettingsInput,
  EmailSettingsCredentials,
  EmailSettingsStatus,
} from "./email-settings";
export {
  MIN_ACTIVE_POLL_INTERVAL_MS,
  MAX_ACTIVE_POLL_INTERVAL_MS,
  MIN_RECONCILIATION_INTERVAL_MS,
  MAX_RECONCILIATION_INTERVAL_MS,
  ACTIVE_POLL_SAFETY_DIVISOR,
  getOrCreateWorkerSettings,
  getMinimumConfiguredSlaTargetMinutes,
  validateWorkerSettingsInput,
  saveWorkerSettings,
  recordWorkerCycleOutcome,
  recordWorkerNextRun,
  deriveWorkerStatus,
  WorkerSettingsValidationError,
} from "./worker-settings";
export type {
  WorkerSettingsInput,
  WorkerSettingsRecord,
  WorkerStatus,
} from "./worker-settings";

export { WORKER_ADVISORY_LOCK_KEY, connectAdvisoryLockConnection } from "./advisory-lock";
export type { AdvisoryLockConnection } from "./advisory-lock";
export { withOrganizationSlaLock } from "./organization-lock";
export { recordSlaImportSummary } from "./sla-import-summary";
export type { SlaImportSummaryInput } from "./sla-import-summary";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

let prisma: PrismaClient | undefined;

/** Lazily-created singleton so apps/web and apps/worker share one connection pool per process. */
export function getPrismaClient(): PrismaClient {
  if (!prisma) prisma = new PrismaClient({ adapter });
  return prisma;
}
