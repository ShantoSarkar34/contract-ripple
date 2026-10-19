import type { NormalizedSchema } from "./types.js";

/** Deterministic JSON-like serialization with object keys sorted. */
export function stableStringify(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): string {
  if (value === null) {
    return "null";
  }

  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "number":
      return Number.isFinite(value) ? String(value) : JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "bigint":
      return `${String(value)}n`;
    case "undefined":
      return "undefined";
    default:
      break;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return '"[Circular]"';
    }
    seen.add(value);
    const result = `[${value
      .map((item) => stableStringify(item, seen))
      .join(",")}]`;
    seen.delete(value);
    return result;
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return '"[Circular]"';
    }
    seen.add(value);
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key], seen)}`);
    seen.delete(value);
    return `{${entries.join(",")}}`;
  }

  return String(value);
}

/**
 * Semantic signature for a normalized schema. Pointers and source locations
 * are deliberately excluded so that moving a schema does not look like a
 * semantic change.
 */
export function schemaSignature(schema: NormalizedSchema): string {
  return stableStringify({
    ref: schema.ref ?? null,
    unresolved: schema.unresolved ?? false,
    externalRef: schema.externalRef ?? false,
    circular: schema.circular ?? false,
    booleanSchema: schema.booleanSchema ?? null,
    types: schema.types,
    format: schema.format ?? null,
    enumValues: schema.enumValues,
    required: schema.required,
    properties: schema.properties.map((property) => [
      property.name,
      schemaSignature(property.schema),
    ]),
    items: schema.items ? schemaSignature(schema.items) : null,
    oneOf: schema.oneOf.map((variant) => schemaSignature(variant)),
    anyOf: schema.anyOf.map((variant) => schemaSignature(variant)),
    constraints: schema.constraints,
    unsupported: schema.unsupported,
  });
}
