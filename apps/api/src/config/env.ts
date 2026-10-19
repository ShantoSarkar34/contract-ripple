import "dotenv/config";

export type NodeEnvironment = "development" | "test" | "production";

export type AppEnv = {
  nodeEnv: NodeEnvironment;
  port: number;
  corsOrigins: string[];
  databaseUrl: string | undefined;
};

const DEFAULT_PORT = 4000;
const DEFAULT_CORS_ORIGIN = "http://localhost:3000";

function parseNodeEnv(value: string | undefined): NodeEnvironment {
  if (value === "production" || value === "test") {
    return value;
  }
  return "development";
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value.trim() === "") {
    return DEFAULT_PORT;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535 (received "${value}").`);
  }
  return port;
}

function parseOrigins(value: string | undefined): string[] {
  const raw = value ?? DEFAULT_CORS_ORIGIN;
  const origins = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) {
    throw new Error("CORS_ORIGINS must contain at least one origin when provided.");
  }
  return origins;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return {
    nodeEnv: parseNodeEnv(source.NODE_ENV),
    port: parsePort(source.PORT),
    corsOrigins: parseOrigins(source.CORS_ORIGINS),
    databaseUrl: source.DATABASE_URL,
  };
}
