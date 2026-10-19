import { parse as parseYaml } from "yaml";
import { isRecord } from "./clone.js";
import { EngineError, errorMessage, sanitizeMessage } from "./errors.js";
import type { ContractFormat, ContractInput } from "./types.js";

export const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Guards against YAML alias expansion attacks ("billion laughs"). The `yaml`
 * package counts every alias dereference during conversion to JavaScript.
 */
export const MAX_YAML_ALIASES = 100;

/**
 * Bounds recursive deep-clone, canonicalization, and normalization work for
 * hostile, deeply nested documents.
 */
export const MAX_DOCUMENT_DEPTH = 128;

export function detectFormat(content: string): ContractFormat {
  const trimmed = content.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[") ? "json" : "yaml";
}

/** UTF-8 byte length without depending on Node or DOM globals. */
function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) {
      bytes += 1;
    } else if (codePoint <= 0x7ff) {
      bytes += 2;
    } else if (codePoint <= 0xffff) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }
  return bytes;
}

/**
 * Rejects documents whose nesting depth would make recursive processing
 * unsafe, and rejects circular aliases that cannot be represented in JSON.
 * Shared (non-circular) YAML aliases are allowed.
 */
function assertDocumentDepth(
  value: unknown,
  label: string,
  depth = 0,
  path: WeakSet<object> = new WeakSet(),
): void {
  if (depth > MAX_DOCUMENT_DEPTH) {
    throw new EngineError(
      "input_too_deep",
      `${label} contract nesting exceeds the ${MAX_DOCUMENT_DEPTH}-level limit`,
    );
  }

  if (Array.isArray(value)) {
    if (path.has(value)) {
      throw new EngineError(
        "circular_input",
        `${label} contract contains a circular YAML alias or object reference`,
      );
    }
    path.add(value);
    for (const item of value) {
      assertDocumentDepth(item, label, depth + 1, path);
    }
    path.delete(value);
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (path.has(value)) {
    throw new EngineError(
      "circular_input",
      `${label} contract contains a circular YAML alias or object reference`,
    );
  }
  path.add(value);
  for (const key of Object.keys(value)) {
    assertDocumentDepth(value[key], label, depth + 1, path);
  }
  path.delete(value);
}

/**
 * Parses untrusted JSON or YAML without resolving references or executing
 * anything. The returned value is still untrusted and must be validated.
 */
export function parseContractInput(
  input: ContractInput,
  label: string,
  maxBytes: number = DEFAULT_MAX_BYTES,
): unknown {
  const content = (input as { content?: unknown } | null | undefined)?.content;
  if (typeof content !== "string") {
    throw new EngineError("empty_input", `${label} contract content must be a string`);
  }

  if (content.trim().length === 0) {
    throw new EngineError("empty_input", `${label} contract is empty`);
  }

  const bytes = utf8ByteLength(content);
  if (bytes > maxBytes) {
    throw new EngineError(
      "input_too_large",
      `${label} contract is ${bytes} bytes, which exceeds the ${maxBytes}-byte limit`,
    );
  }

  const requestedFormat = (input as { format?: unknown } | null | undefined)?.format;
  if (
    requestedFormat !== undefined &&
    requestedFormat !== "json" &&
    requestedFormat !== "yaml"
  ) {
    throw new EngineError(
      "invalid_options",
      `${label} contract format must be "json" or "yaml"`,
    );
  }

  const format = requestedFormat ?? detectFormat(content);

  let parsed: unknown;

  if (format === "json") {
    try {
      parsed = JSON.parse(content) as unknown;
    } catch (error) {
      throw new EngineError(
        "invalid_json",
        `${label} contract is not valid JSON: ${sanitizeMessage(errorMessage(error))}`,
      );
    }
  } else {
    try {
      parsed = parseYaml(content, {
        schema: "core",
        strict: true,
        uniqueKeys: true,
        maxAliasCount: MAX_YAML_ALIASES,
      }) as unknown;
    } catch (error) {
      throw new EngineError(
        "invalid_yaml",
        `${label} contract is not valid YAML: ${sanitizeMessage(errorMessage(error))}`,
      );
    }
  }

  assertDocumentDepth(parsed, label);
  return parsed;
}
