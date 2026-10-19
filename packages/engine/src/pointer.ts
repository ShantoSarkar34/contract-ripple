/**
 * RFC 6901 JSON Pointer helpers. OpenAPI references use the URI fragment form
 * (`#/paths/~1pets/get`), so segments must be unescaped after percent decoding.
 */

export function escapePointerSegment(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

export function unescapePointerSegment(segment: string): string {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

/** Builds a pointer from root-level segments. */
export function pointer(...segments: Array<string | number>): string {
  if (segments.length === 0) {
    return "#";
  }
  return `#/${segments.map((segment) => escapePointerSegment(String(segment))).join("/")}`;
}

/** Appends segments to an existing pointer. */
export function appendPointer(base: string, ...segments: Array<string | number>): string {
  if (segments.length === 0) {
    return base;
  }
  const suffix = segments
    .map((segment) => escapePointerSegment(String(segment)))
    .join("/");
  return base === "#" ? `#/${suffix}` : `${base}/${suffix}`;
}

export function parsePointer(ref: string): string[] | undefined {
  if (ref === "#" || ref === "") {
    return [];
  }
  if (!ref.startsWith("#/")) {
    return undefined;
  }

  let fragment: string;
  try {
    fragment = decodeURIComponent(ref.slice(1));
  } catch {
    return undefined;
  }

  return fragment
    .slice(1)
    .split("/")
    .map((segment) => unescapePointerSegment(segment));
}

/**
 * Resolves an internal JSON Pointer against an unknown document. Returns
 * `undefined` for external references, malformed pointers, and missing paths.
 */
export function resolvePointer(root: unknown, ref: string): unknown {
  const segments = parsePointer(ref);
  if (!segments) {
    return undefined;
  }

  let current: unknown = root;
  for (const segment of segments) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return undefined;
      }
      current = current[index];
      continue;
    }

    const record = current as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(record, segment)) {
      return undefined;
    }
    current = record[segment];
  }

  return current;
}

export function isInternalRef(ref: string): boolean {
  return ref === "#" || ref.startsWith("#/");
}
