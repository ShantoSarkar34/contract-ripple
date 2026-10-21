import type { RequestHandler } from "express";
import helmetModule from "helmet";
import type { HelmetOptions } from "helmet";

type HelmetFactory = (options?: Readonly<HelmetOptions>) => RequestHandler;

/**
 * Helmet publishes separate CommonJS and ESM entry points. Vercel's Node
 * builder type-checks serverless entrypoints with a resolver that binds the
 * default import to the module namespace (TS2349), even though Node loads the
 * callable factory at runtime. Pinning the runtime shape here keeps the
 * workaround isolated and the middleware fully typed at the call site.
 */
export const securityHeaders: HelmetFactory =
  helmetModule as unknown as HelmetFactory;
