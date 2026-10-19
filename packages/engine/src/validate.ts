import { validate as validateOpenApi } from "@readme/openapi-parser";
import type { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import { cloneJsonValue, isRecord } from "./clone.js";
import { EngineError, errorMessage, sanitizeMessage } from "./errors.js";
import type { ContractSummary } from "./types.js";

const SUPPORTED_VERSION = /^3\.(0|1)\.\d+(?:[-+].*)?$/;

type SupportedDocument = OpenAPIV3.Document | OpenAPIV3_1.Document;

/**
 * Validates a parsed document against the OpenAPI 3.0/3.1 schemas and returns
 * safe metadata. External references are explicitly disabled so validation can
 * never make a network or filesystem request on behalf of an uploaded file.
 */
export async function validateContract(
  document: unknown,
  label: string,
): Promise<ContractSummary> {
  if (!isRecord(document)) {
    throw new EngineError("invalid_openapi", `${label} contract root must be an object`);
  }

  const openapi = document.openapi;
  if (typeof openapi !== "string") {
    if (document.swagger === "2.0") {
      throw new EngineError(
        "unsupported_version",
        `${label} contract uses Swagger 2.0; only OpenAPI 3.0.x and 3.1.x are supported`,
      );
    }
    throw new EngineError(
      "unsupported_version",
      `${label} contract must declare a supported openapi version (3.0.x or 3.1.x)`,
    );
  }

  if (!SUPPORTED_VERSION.test(openapi)) {
    throw new EngineError(
      "unsupported_version",
      `${label} contract declares openapi ${sanitizeMessage(openapi, 40)}; only 3.0.x and 3.1.x are supported`,
    );
  }

  let result: Awaited<ReturnType<typeof validateOpenApi>>;
  try {
    // `validate()` dereferences in place and can create circular object graphs.
    // Validate a clone so the engine keeps the original `$ref` structure and
    // can resolve references safely with its own cycle detection.
    const validationDocument = cloneJsonValue(document) as SupportedDocument;
    result = await validateOpenApi(validationDocument, {
      resolve: { external: false, file: false },
      timeoutMs: 5_000,
      validate: {
        errors: { colorize: false, codeFrames: false },
      },
    });
  } catch (error) {
    throw new EngineError(
      "invalid_openapi",
      `${label} contract failed OpenAPI validation: ${sanitizeMessage(errorMessage(error))}`,
    );
  }

  if (!result.valid) {
    const details = result.errors.slice(0, 10).map((item) => sanitizeMessage(item.message));
    const total = result.errors.length + result.additionalErrors;
    throw new EngineError(
      "invalid_openapi",
      `${label} contract failed OpenAPI validation with ${total} error(s)`,
      details,
    );
  }

  const info = isRecord(document.info) ? document.info : {};
  return {
    openapi,
    title: typeof info.title === "string" ? sanitizeMessage(info.title, 200) : undefined,
    version: typeof info.version === "string" ? sanitizeMessage(info.version, 100) : undefined,
    warnings: result.warnings.slice(0, 20).map((item) => sanitizeMessage(item.message)),
  };
}
