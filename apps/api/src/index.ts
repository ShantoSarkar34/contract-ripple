import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";

const env = loadEnv();
const app = createApp({ corsOrigins: env.corsOrigins });

const server = app.listen(env.port, () => {
  console.log(`[api] listening on http://localhost:${env.port} (${env.nodeEnv})`);
});

function shutdown(signal: string): void {
  console.log(`[api] received ${signal}, shutting down`);
  server.close((error) => {
    if (error) {
      console.error("[api] shutdown error:", error.message);
      process.exitCode = 1;
    }
    process.exit();
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
