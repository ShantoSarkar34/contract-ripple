import type { ChangeType, FindingCategory, RiskLevel } from "@contract-ripple/shared";

export const RISK_LABELS: Record<RiskLevel, string> = {
  non_breaking: "Non-breaking",
  potentially_breaking: "Potentially breaking",
  unknown: "Unknown",
};

/** Deterministic display order for risk filters and graph sorting. */
export const RISK_ORDER: readonly RiskLevel[] = [
  "potentially_breaking",
  "unknown",
  "non_breaking",
];

/** ZIP entries can use Windows separators; show repository paths consistently. */
export function displayPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

export const RISK_BADGE_CLASSES: Record<RiskLevel, string> = {
  non_breaking: "bg-success-light text-success border border-success/20",
  potentially_breaking: "bg-danger-light text-danger border border-danger/20",
  unknown: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
};

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  added: "Added",
  removed: "Removed",
  modified: "Modified",
};

export const CHANGE_TYPE_CLASSES: Record<ChangeType, string> = {
  added: "text-success",
  removed: "text-danger",
  modified: "text-warning",
};

export const CATEGORY_LABELS: Record<FindingCategory, string> = {
  operation: "Operation",
  operation_id: "Operation ID",
  parameter: "Parameter",
  request_body: "Request body",
  response: "Response",
  required_property: "Required property",
  schema_property: "Schema property",
  reference: "Reference",
  combinator: "Composition",
};

export const CONFIDENCE_LABELS: Record<"high" | "medium" | "low", string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const CONFIDENCE_CLASSES: Record<"high" | "medium" | "low", string> = {
  high: "text-success",
  medium: "text-warning",
  low: "text-slate-500 dark:text-slate-400",
};

/** HTTP method color tokens used by the findings list. */
export const METHOD_CLASSES: Record<string, string> = {
  get: "bg-primary-light text-primary border border-primary/20",
  post: "bg-success-light text-success border border-success/20",
  put: "bg-warning-light text-warning border border-warning/20",
  patch: "bg-warning-light text-warning border border-warning/20",
  delete: "bg-danger-light text-danger border border-danger/20",
  options: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  head: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
};

export function methodClass(method: string | null): string {
  if (!method) {
    return METHOD_CLASSES.options ?? "";
  }
  return METHOD_CLASSES[method.toLowerCase()] ?? METHOD_CLASSES.options ?? "";
}
