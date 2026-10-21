import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import {
  createGithubSourceRequestSchema,
  zipSourceFieldsSchema,
  type ListSourceSnapshotsResponse,
} from "@contract-ripple/shared";
import type { Repository } from "../db/types.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError, badRequest } from "../middleware/http-error.js";
import { parseWithSchema } from "../middleware/validate.js";
import {
  analyzeGitHubSource,
  analyzeZipSource,
  getGitHubStatus,
  getSourceSnapshot,
  listSourceSnapshots,
  type SourceServiceOptions,
} from "../services/source.js";
import {
  enforceRateLimit,
  rateLimitKey,
  type RateLimitConfig,
} from "../services/rate-limit.js";
import { MAX_ARCHIVE_BYTES } from "../services/zip.js";
import { requiredParam } from "./params.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_ARCHIVE_BYTES,
    files: 1,
    fields: 2,
    fieldSize: 1024,
  },
});

function uploadArchive(request: Request, response: Response, next: NextFunction): void {
  upload.single("archive")(request, response, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        next(
          new HttpError(
            413,
            "archive_too_large",
            `ZIP uploads are limited to ${MAX_ARCHIVE_BYTES} bytes.`,
          ),
        );
        return;
      }
      next(badRequest("invalid_upload", "The ZIP upload was rejected."));
      return;
    }
    next(error);
  });
}

export function createSourceRouter(
  repository: Repository,
  options: SourceServiceOptions,
  rateLimits: RateLimitConfig,
): Router {
  const router = Router();

  router.get("/github/status", (_request, response) => {
    response.status(200).json(getGitHubStatus(options));
  });

  router.post(
    "/projects/:projectId/source/zip",
    uploadArchive,
    asyncHandler(async (request, response) => {
      const auth = requireAuth(request);
      if (!request.file) {
        throw badRequest("archive_required", "Attach a ZIP archive in the `archive` field.");
      }
      const fields = parseWithSchema(zipSourceFieldsSchema, request.body);
      await enforceRateLimit(
        repository,
        rateLimitKey("source:analyze:user", auth.user.id),
        rateLimits.sourceAnalysisPerUser,
      );
      const snapshot = await analyzeZipSource(
        repository,
        auth.user.id,
        requiredParam(request, "projectId"),
        request.file.buffer,
        fields,
      );
      response.status(201).json(snapshot);
    }),
  );

  router.post(
    "/projects/:projectId/source/github",
    asyncHandler(async (request, response) => {
      const auth = requireAuth(request);
      const input = parseWithSchema(createGithubSourceRequestSchema, request.body);
      await enforceRateLimit(
        repository,
        rateLimitKey("source:analyze:user", auth.user.id),
        rateLimits.sourceAnalysisPerUser,
      );
      const snapshot = await analyzeGitHubSource(
        repository,
        auth.user.id,
        requiredParam(request, "projectId"),
        input,
        options,
      );
      response.status(201).json(snapshot);
    }),
  );

  router.get(
    "/projects/:projectId/source",
    asyncHandler(async (request, response) => {
      const auth = requireAuth(request);
      const body: ListSourceSnapshotsResponse = await listSourceSnapshots(
        repository,
        auth.user.id,
        requiredParam(request, "projectId"),
      );
      response.status(200).json(body);
    }),
  );

  router.get(
    "/source/:snapshotId",
    asyncHandler(async (request, response) => {
      const auth = requireAuth(request);
      const snapshot = await getSourceSnapshot(
        repository,
        auth.user.id,
        requiredParam(request, "snapshotId"),
      );
      response.status(200).json(snapshot);
    }),
  );

  return router;
}
