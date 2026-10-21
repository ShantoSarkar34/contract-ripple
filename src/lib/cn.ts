export type ClassValue = string | number | false | null | undefined;

/** Joins truthy class names. Keeps components readable without a dependency. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
