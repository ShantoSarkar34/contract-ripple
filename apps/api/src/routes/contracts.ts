import { Router } from "express";
import {
  createContractRequestSchema,
  createContractVersionRequestSchema,
  type ListContractsResponse,
  type ListVersionsResponse,
} from "@contract-ripple/shared";
import type { Repository } from "../db/types.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth } from "../middleware/auth.js";
import { parseWithSchema } from "../middleware/validate.js";
import {
  createContract,
  createContractVersion,
  getContract,
  getVersion,
  listContracts,
  listVersions,
} from "../services/contracts.js";
import { requiredParam } from "./params.js";

export function createContractsRouter(repository: Repository): Router {
  const router = Router();

  router.post(
    "/projects/:projectId/contracts",
    asyncHandler(async (request, response) => {
      const auth = requireAuth(request);
      const input = parseWithSchema(createContractRequestSchema, request.body);
      const contract = await createContract(
        repository,
        auth.user.id,
        requiredParam(request, "projectId"),
        input,
      );
      response.status(201).json(contract);
    }),
  );

  router.get(
    "/projects/:projectId/contracts",
    asyncHandler(async (request, response) => {
      const auth = requireAuth(request);
      const contracts = await listContracts(
        repository,
        auth.user.id,
        requiredParam(request, "projectId"),
      );
      const body: ListContractsResponse = { contracts };
      response.status(200).json(body);
    }),
  );

  router.get(
    "/contracts/:contractId",
    asyncHandler(async (request, response) => {
      const auth = requireAuth(request);
      const contract = await getContract(
        repository,
        auth.user.id,
        requiredParam(request, "contractId"),
      );
      response.status(200).json(contract);
    }),
  );

  router.post(
    "/contracts/:contractId/versions",
    asyncHandler(async (request, response) => {
      const auth = requireAuth(request);
      const input = parseWithSchema(createContractVersionRequestSchema, request.body);
      const version = await createContractVersion(
        repository,
        auth.user.id,
        requiredParam(request, "contractId"),
        input,
      );
      response.status(201).json(version);
    }),
  );

  router.get(
    "/contracts/:contractId/versions",
    asyncHandler(async (request, response) => {
      const auth = requireAuth(request);
      const versions = await listVersions(
        repository,
        auth.user.id,
        requiredParam(request, "contractId"),
      );
      const body: ListVersionsResponse = { versions };
      response.status(200).json(body);
    }),
  );

  router.get(
    "/versions/:versionId",
    asyncHandler(async (request, response) => {
      const auth = requireAuth(request);
      const version = await getVersion(
        repository,
        auth.user.id,
        requiredParam(request, "versionId"),
      );
      response.status(200).json(version);
    }),
  );

  return router;
}
