import { cloneJsonValue, isRecord } from "./clone.js";
import { stableStringify } from "./schema-signature.js";

function parameterSortKey(value: unknown): string {
  if (!isRecord(value)) {
    return stableStringify(value);
  }
  const location = typeof value.in === "string" ? value.in : "";
  const name = typeof value.name === "string" ? value.name : "";
  const ref = typeof value.$ref === "string" ? value.$ref : "";
  return [location, name, ref, stableStringify(value)].join("\u0000");
}

function schemaSortKey(value: unknown): string {
  return stableStringify(value);
}

function canonicalizeNode(value: unknown, seen: WeakSet<object> = new WeakSet()): void {
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return;
    }
    seen.add(value);
    for (const item of value) {
      canonicalizeNode(item, seen);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  if (Array.isArray(value.parameters)) {
    value.parameters = [...value.parameters].sort((left, right) =>
      parameterSortKey(left).localeCompare(parameterSortKey(right)),
    );
  }

  // `oneOf` and `anyOf` are unordered alternatives. Sorting them makes
  // evidence pointers stable when a document is reordered but semantically
  // unchanged. `allOf` is intentionally not sorted because merge precedence
  // is observable.
  for (const keyword of ["oneOf", "anyOf"] as const) {
    if (Array.isArray(value[keyword])) {
      value[keyword] = [...value[keyword]].sort((left, right) =>
        schemaSortKey(left).localeCompare(schemaSortKey(right)),
      );
    }
  }

  for (const key of Object.keys(value)) {
    canonicalizeNode(value[key], seen);
  }
}

/**
 * Returns a clone of the parsed contract with semantically unordered arrays
 * sorted. This keeps JSON Pointers and finding IDs stable when a client
 * reorders parameters or composition alternatives without changing meaning.
 */
export function canonicalizeContract(document: unknown): unknown {
  const clone = cloneJsonValue(document);
  canonicalizeNode(clone);
  return clone;
}
