import { Router } from "express";
import { buildHealthResponse } from "../services/health.js";

export const healthRouter: Router = Router();

healthRouter.get("/health", (_request, response) => {
  response.status(200).json(buildHealthResponse());
});
