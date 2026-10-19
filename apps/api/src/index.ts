import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { disconnectPrisma, getPrismaClient } from "./db/prisma.js";
import { PrismaRepository } from "./db/prisma-repository.js";

const env = loadEnv();
const repository = new PrismaRepository(getPrismaClient());
const app = createApp({ corsOrigins: env.corsOrigins, repository });

const server = app.listen(env.port, () => {
  console.log(`[api] listening on http://localhost:${env.port} (${env.nodeEnv})`);
});

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`[api] received ${signal}, shutting down`);

  server.close((error) => {
    void disconnectPrisma()
      .catch((disconnectError: unknown) => {
        console.error(
          "[api] failed to disconnect Prisma:",
          disconnectError instanceof Error ? disconnectError.message : String(disconnectError),
        );
        process.exitCode = 1;
      })
      .finally(() => {
        if (error) {
          console.error("[api] shutdown error:", error.message);
          process.exitCode = 1;
        }
        process.exit();
      });
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
