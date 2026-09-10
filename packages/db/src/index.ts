import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
export * from "../generated/prisma/client";
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

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

let prisma: PrismaClient | undefined;

/** Lazily-created singleton so apps/web and apps/worker share one connection pool per process. */
export function getPrismaClient(): PrismaClient {
  if (!prisma) prisma = new PrismaClient({ adapter });
  return prisma;
}
