import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

let prisma: PrismaClient | undefined;

/** Lazily-created singleton so apps/web and apps/worker share one connection pool per process. */
export function getPrismaClient(): PrismaClient {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}
