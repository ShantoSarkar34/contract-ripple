import { PrismaClient } from "@prisma/client";

let client: PrismaClient | undefined;

/**
 * Lazily creates a single Prisma client per process. The API never creates a
 * client at import time so tests and tooling can control the lifecycle.
 */
export function getPrismaClient(): PrismaClient {
  if (!client) {
    client = new PrismaClient();
  }
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = undefined;
  }
}
