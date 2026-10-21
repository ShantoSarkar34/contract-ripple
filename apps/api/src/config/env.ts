import "dotenv/config";

export type NodeEnvironment = "development" | "test" | "production";

export type CookieSameSite = "lax" | "strict" | "none";

export type AppEnv = {
  nodeEnv: NodeEnvironment;
  port: number;
  corsOrigins: string[];
  databaseUrl: string | undefined;
  githubToken: string;
  githubApiBaseUrl: string;
  authSecret: string;
  cookieSecure: boolean;
  cookieSameSite: CookieSameSite;
  trustProxy: boolean;
};

const DEFAULT_PORT = 4000;
const DEFAULT_CORS_ORIGIN = "http://localhost:3000";
const DEFAULT_GITHUB_API_BASE_URL = "https://api.github.com";
const DEVELOPMENT_AUTH_SECRET =
  "contract-ripple-development-only-auth-secret-change-before-deploying";

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

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error("Boolean environment values must be exactly `true` or `false`.");
}

function parseAuthSecret(value: string | undefined, nodeEnv: NodeEnvironment): string {
  if (value === undefined || value.trim() === "") {
    if (nodeEnv === "production") {
      throw new Error("AUTH_SECRET is required in production (at least 32 characters).");
    }
    return DEVELOPMENT_AUTH_SECRET;
  }

  const secret = value.trim();
  if (secret.length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 characters.");
  }
  return secret;
}

function parseCookieSameSite(value: string | undefined): CookieSameSite {
  const normalized = (value ?? "lax").trim().toLowerCase();
  if (normalized === "lax" || normalized === "strict" || normalized === "none") {
    return normalized;
  }
  throw new Error("AUTH_COOKIE_SAME_SITE must be one of: lax, strict, none.");
}

function parseGitHubApiBaseUrl(value: string | undefined): string {
  const raw = (value ?? DEFAULT_GITHUB_API_BASE_URL).trim().replace(/\/+$/, "");
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("unsupported protocol");
    }
  } catch {
    throw new Error("GITHUB_API_BASE_URL must be a valid http(s) URL.");
  }
  return raw;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const nodeEnv = parseNodeEnv(source.NODE_ENV);
  const cookieSecure = parseBoolean(
    source.AUTH_COOKIE_SECURE,
    nodeEnv === "production",
  );
  const cookieSameSite = parseCookieSameSite(source.AUTH_COOKIE_SAME_SITE);

  if (cookieSameSite === "none" && !cookieSecure) {
    throw new Error("AUTH_COOKIE_SAME_SITE=none requires AUTH_COOKIE_SECURE=true.");
  }

  return {
    nodeEnv,
    port: parsePort(source.PORT),
    corsOrigins: parseOrigins(source.CORS_ORIGINS),
    databaseUrl: source.DATABASE_URL,
    githubToken: source.GITHUB_TOKEN?.trim() ?? "",
    githubApiBaseUrl: parseGitHubApiBaseUrl(source.GITHUB_API_BASE_URL),
    authSecret: parseAuthSecret(source.AUTH_SECRET, nodeEnv),
    cookieSecure,
    cookieSameSite,
    trustProxy: parseBoolean(source.TRUST_PROXY, nodeEnv === "production"),
  };
}
