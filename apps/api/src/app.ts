import cors from "cors";
import express, { type Express } from "express";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { healthRouter } from "./routes/health.js";

export type CreateAppOptions = {
  corsOrigins: string[];
};

/**
 * Builds the Express application without starting a listener. Keeping this
 * separate from `index.ts` makes the app testable and reusable.
 */
export function createApp({ corsOrigins }: CreateAppOptions): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: corsOrigins }));
  app.use(express.json({ limit: "1mb" }));

  app.use("/api/v1", healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
