export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep-clones parsed JSON/YAML data. `Object.defineProperty` preserves keys
 * such as `__proto__` as own data properties instead of invoking prototype
 * setters. A `WeakMap` preserves shared references and prevents infinite
 * recursion on circular YAML aliases.
 */
export function cloneJsonValue(
  value: unknown,
  seen: WeakMap<object, unknown> = new WeakMap(),
): unknown {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (Array.isArray(value)) {
    const existing = seen.get(value);
    if (existing !== undefined) {
      return existing;
    }
    const copy: unknown[] = [];
    seen.set(value, copy);
    for (const item of value) {
      copy.push(cloneJsonValue(item, seen));
    }
    return copy;
  }

  if (isRecord(value)) {
    const existing = seen.get(value);
    if (existing !== undefined) {
      return existing;
    }
    const copy: Record<string, unknown> = {};
    seen.set(value, copy);
    for (const key of Object.keys(value)) {
      Object.defineProperty(copy, key, {
        value: cloneJsonValue(value[key], seen),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return copy;
  }

  return value;
}
