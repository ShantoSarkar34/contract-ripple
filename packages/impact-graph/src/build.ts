/**
 * Evidence-backed impact graph construction.
 *
 * Inputs are comparison findings and persisted source-impact matches. The
 * builder groups findings into changed operations, matches source impacts to
 * those operations by HTTP method and path, and emits operation/file nodes with
 * the evidence that produced them. It never fabricates a relationship: an edge
 * exists only when a persisted source match names the same operation.
 */

import {
  IMPACT_GRAPH_LIMITS,
  type FindingLike,
  type GraphConfidence,
  type GraphRiskLevel,
  type ImpactGraph,
  type ImpactGraphEdge,
  type ImpactGraphFileNode,
  type ImpactGraphFilterValues,
  type ImpactGraphFindingEvidence,
  type ImpactGraphFilters,
  type ImpactGraphImpactEvidence,
  type ImpactGraphLimits,
  type ImpactGraphOperationNode,
  type ImpactGraphOptions,
  type ImpactLike,
} from "./types.js";

const RISK_RANK: Record<GraphRiskLevel, number> = {
  potentially_breaking: 3,
  unknown: 2,
  non_breaking: 1,
};

const CONFIDENCE_RANK: Record<GraphConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const RISK_ORDER: readonly GraphRiskLevel[] = ["potentially_breaking", "unknown", "non_breaking"];
const CONFIDENCE_ORDER: readonly GraphConfidence[] = ["high", "medium", "low"];

type ResolvedFilters = {
  risk: GraphRiskLevel | "all";
  category: string | "all";
  method: string | "all";
  confidence: GraphConfidence | "all";
  query: string;
};

/** Lower-cases and trims an HTTP method, returning `null` when unusable. */
export function normalizeMethod(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/** Normalizes an API path so equivalent spellings match the same operation. */
export function normalizePath(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  let path = value.trim().replace(/\\/g, "/");
  if (path.length === 0) {
    return null;
  }
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  path = path.replace(/\/{2,}/g, "/");
  while (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  return path.length > 0 ? path : "/";
}

/** Collects the filter options present in the current inputs, deterministically. */
export function collectFilterValues(
  findings: readonly FindingLike[],
  impacts: readonly ImpactLike[],
): ImpactGraphFilterValues {
  const risks = new Set<GraphRiskLevel>();
  const categories = new Set<string>();
  const methods = new Set<string>();
  const confidences = new Set<GraphConfidence>();

  for (const finding of findings) {
    risks.add(finding.risk);
    if (finding.category.length > 0) {
      categories.add(finding.category);
    }
    const method = normalizeMethod(finding.method);
    if (method) {
      methods.add(method);
    }
  }
  for (const impact of impacts) {
    confidences.add(impact.confidence);
  }

  return {
    risks: RISK_ORDER.filter((risk) => risks.has(risk)),
    categories: [...categories].sort((a, b) => a.localeCompare(b)),
    methods: [...methods].sort((a, b) => a.localeCompare(b)),
    confidences: CONFIDENCE_ORDER.filter((confidence) => confidences.has(confidence)),
  };
}

export function buildImpactGraph(
  findings: readonly FindingLike[],
  impacts: readonly ImpactLike[],
  options: ImpactGraphOptions = {},
): ImpactGraph {
  const limits: ImpactGraphLimits = { ...IMPACT_GRAPH_LIMITS, ...options.limits };
  const filters = resolveFilters(options.filters);
  const source = options.source ?? null;
  const queryActive = filters.query.length > 0;
  const limitations: string[] = [];

  /* Group findings into changed operations after structural filters. */
  const groups = new Map<string, OperationDraft>();
  let unmappedFindingCount = 0;

  for (const finding of findings) {
    if (filters.risk !== "all" && finding.risk !== filters.risk) {
      continue;
    }
    if (filters.category !== "all" && finding.category !== filters.category) {
      continue;
    }
    const method = normalizeMethod(finding.method);
    const path = normalizePath(finding.path);
    if (!method || !path) {
      unmappedFindingCount += 1;
      continue;
    }
    if (filters.method !== "all" && method !== filters.method) {
      continue;
    }
    const key = operationKey(method, path);
    const existing = groups.get(key);
    if (existing) {
      existing.findings.push(finding);
    } else {
      groups.set(key, {
        key,
        method,
        path,
        findings: [finding],
        operationId: null,
        matchesQuery: false,
      });
    }
  }

  const operationDrafts: OperationDraft[] = [];
  for (const group of groups.values()) {
    const operationId =
      group.findings
        .map((finding) => finding.operationId)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .sort((a, b) => a.localeCompare(b))[0] ?? null;
    const matchesQuery = matchesQueryText(filters.query, [
      group.method,
      group.path,
      operationId,
      ...group.findings.flatMap((finding) => [
        finding.summary,
        finding.location,
        finding.category,
        finding.changeType,
      ]),
    ]);
    operationDrafts.push({ ...group, operationId, matchesQuery });
  }

  /* Match source impacts to operations. */
  const availableImpacts = source ? impacts : [];
  let unmatchedImpactCount = 0;
  const impactDrafts: ImpactDraft[] = [];

  for (const impact of availableImpacts) {
    if (filters.confidence !== "all" && impact.confidence !== filters.confidence) {
      continue;
    }
    const method = normalizeMethod(impact.matchedMethod);
    const path = normalizePath(impact.matchedPath);
    if (!method || !path) {
      unmatchedImpactCount += 1;
      continue;
    }
    const key = operationKey(method, path);
    const operation = operationDrafts.find((draft) => draft.key === key);
    if (!operation) {
      unmatchedImpactCount += 1;
      continue;
    }
    const matchesQuery =
      operation.matchesQuery ||
      matchesQueryText(filters.query, [
        impact.filePath,
        impact.call,
        impact.path,
        impact.matchedPath,
        impact.matchedMethod,
        impact.operationId,
        impact.snippet,
        impact.evidence,
      ]);
    impactDrafts.push({ impact, key, matchesQuery });
  }

  const impactsByKey = new Map<string, number>();
  for (const draft of impactDrafts) {
    if (queryActive && !draft.matchesQuery) {
      continue;
    }
    impactsByKey.set(draft.key, (impactsByKey.get(draft.key) ?? 0) + 1);
  }

  const keptOperations = operationDrafts.filter(
    (operation) =>
      !queryActive || operation.matchesQuery || (impactsByKey.get(operation.key) ?? 0) > 0,
  );
  const keptKeys = new Set(keptOperations.map((operation) => operation.key));
  const queryMatchedKeys = new Set(
    keptOperations.filter((operation) => operation.matchesQuery).map((operation) => operation.key),
  );
  const finalImpacts = impactDrafts.filter((draft) => {
    if (!keptKeys.has(draft.key)) {
      return false;
    }
    if (!queryActive) {
      return true;
    }
    return queryMatchedKeys.has(draft.key) || draft.matchesQuery;
  });

  /* Build operation nodes. */
  const operationNodes: OperationNodeWithKey[] = keptOperations.map((operation) => {
    const sortedFindings = [...operation.findings].sort(compareById);
    const evidenceTruncated = sortedFindings.length > limits.maxEvidencePerRelation;
    return {
      id: `operation:${operation.key}`,
      kind: "operation",
      key: operation.key,
      method: operation.method,
      path: operation.path,
      operationId: operation.operationId,
      risk: highestRisk(sortedFindings),
      findingCount: sortedFindings.length,
      evidenceTruncated,
      findings: sortedFindings.slice(0, limits.maxEvidencePerRelation).map(toFindingEvidence),
    };
  });

  /* Aggregate impacts per operation/file relationship. */
  const edgeDrafts = new Map<string, EdgeDraft>();
  for (const draft of finalImpacts) {
    const filePath = draft.impact.filePath;
    const key = `${draft.key}::${filePath}`;
    const existing = edgeDrafts.get(key);
    if (existing) {
      existing.impacts.push(draft.impact);
    } else {
      edgeDrafts.set(key, {
        key,
        operationId: `operation:${draft.key}`,
        filePath,
        fileId: `file:${filePath}`,
        impacts: [draft.impact],
      });
    }
  }

  const totalOperationCount = operationNodes.length;
  const totalRelationCount = edgeDrafts.size;
  const totalFileCount = new Set([...edgeDrafts.values()].map((edge) => edge.filePath)).size;

  /* Apply limits: operations, then relationships, then files. */
  const sortedOperations = [...operationNodes].sort(compareOperationNodes);
  const limitedOperations = sortedOperations.slice(0, limits.maxOperations);
  const limitedOperationIds = new Set(limitedOperations.map((node) => node.id));

  const edgesForOperations = [...edgeDrafts.values()].filter((edge) =>
    limitedOperationIds.has(edge.operationId),
  );
  const sortedEdges = [...edgesForOperations].sort(compareEdgeDrafts);
  const limitedEdgesByCount = sortedEdges.slice(0, limits.maxEdges);

  const fileImpactTotals = new Map<string, number>();
  for (const edge of limitedEdgesByCount) {
    fileImpactTotals.set(
      edge.filePath,
      (fileImpactTotals.get(edge.filePath) ?? 0) + edge.impacts.length,
    );
  }
  const sortedFilePaths = [...fileImpactTotals.keys()].sort(
    (a, b) => (fileImpactTotals.get(b) ?? 0) - (fileImpactTotals.get(a) ?? 0) || a.localeCompare(b),
  );
  const limitedFilePaths = sortedFilePaths.slice(0, limits.maxFiles);
  const limitedFilePathSet = new Set(limitedFilePaths);
  const limitedEdges = limitedEdgesByCount.filter((edge) =>
    limitedFilePathSet.has(edge.filePath),
  );

  const operationLimitHit = totalOperationCount > limitedOperations.length;
  const fileLimitHit = sortedFilePaths.length > limitedFilePaths.length;
  const edgeLimitHit = sortedEdges.length > limitedEdgesByCount.length;

  /* Materialize edges and file nodes from the limited relationship set. */
  const edges: ImpactGraphEdge[] = [];
  const fileNodes = new Map<string, { impactCount: number; confidence: GraphConfidence }>();
  let evidenceTruncated = false;

  for (const draft of limitedEdges) {
    const sortedImpacts = [...draft.impacts].sort(compareById);
    const truncated = sortedImpacts.length > limits.maxEvidencePerRelation;
    evidenceTruncated = evidenceTruncated || truncated;
    const confidence = highestConfidence(sortedImpacts);
    edges.push({
      id: `edge:${draft.key}`,
      source: draft.operationId,
      target: draft.fileId,
      impactCount: sortedImpacts.length,
      highestConfidence: confidence,
      evidenceTruncated: truncated,
      impacts: sortedImpacts.slice(0, limits.maxEvidencePerRelation).map(toImpactEvidence),
    });

    const existing = fileNodes.get(draft.filePath);
    if (existing) {
      existing.impactCount += sortedImpacts.length;
      if (CONFIDENCE_RANK[confidence] > CONFIDENCE_RANK[existing.confidence]) {
        existing.confidence = confidence;
      }
    } else {
      fileNodes.set(draft.filePath, { impactCount: sortedImpacts.length, confidence });
    }
  }

  const files: ImpactGraphFileNode[] = [...fileNodes.entries()]
    .map(([filePath, value]) => ({
      id: `file:${filePath}`,
      kind: "file" as const,
      filePath,
      impactCount: value.impactCount,
      highestConfidence: value.confidence,
    }))
    .sort(
      (a, b) => b.impactCount - a.impactCount || a.filePath.localeCompare(b.filePath),
    );

  const operationEvidenceTruncated = limitedOperations.some((node) => node.evidenceTruncated);
  const truncated =
    operationLimitHit || fileLimitHit || edgeLimitHit || evidenceTruncated || operationEvidenceTruncated;
  const filtersActive =
    filters.risk !== "all" ||
    filters.category !== "all" ||
    filters.method !== "all" ||
    filters.confidence !== "all" ||
    queryActive;

  if (!source) {
    limitations.push(
      "No source analysis is selected, so source-file relationships are unavailable. Run a ZIP or GitHub analysis and open the graph again.",
    );
  }
  if (findings.length === 0) {
    limitations.push("The comparison reported no findings, so the impact graph is empty.");
  } else if (unmappedFindingCount > 0) {
    limitations.push(
      `${unmappedFindingCount} finding(s) do not identify both an HTTP method and a path and cannot be placed on the graph. Open the comparison findings table to review them.`,
    );
  }
  if (unmatchedImpactCount > 0) {
    limitations.push(
      `${unmatchedImpactCount} source match(es) did not correspond to a shown changed operation and were excluded.`,
    );
  }
  if (source && keptOperations.length === 0 && findings.length > 0) {
    limitations.push(
      filtersActive
        ? "No changed operations match the current filters."
        : "No changed operation could be derived from the comparison findings.",
    );
  }
  if (source && keptOperations.length > 0 && finalImpacts.length === 0) {
    limitations.push(
      "No statically resolvable source calls matched the changed operations in this snapshot. Dynamic URLs, wrappers, and generated clients may still be affected.",
    );
  }
  if (filtersActive && findings.length > 0) {
    limitations.push(
      "The current filters are hiding some operations, files, or relationships. Clear the filters to see the full graph.",
    );
  }
  if (operationLimitHit) {
    limitations.push(
      `Showing the highest-risk ${limitedOperations.length} of ${totalOperationCount} changed operations. Narrow the filters to see the rest.`,
    );
  }
  if (fileLimitHit) {
    limitations.push(
      `Showing the ${files.length} most affected of ${sortedFilePaths.length} source files. Narrow the filters to see the rest.`,
    );
  }
  if (edgeLimitHit) {
    limitations.push(
      `Showing ${edges.length} of ${sortedEdges.length} operation-to-file relationships. Narrow the filters to see the rest.`,
    );
  }
  if (evidenceTruncated || operationEvidenceTruncated) {
    limitations.push(
      "Some evidence lists in the graph are truncated; the source evidence list below contains every match.",
    );
  }

  return {
    source,
    filters: {
      risk: filters.risk,
      category: filters.category,
      method: filters.method,
      confidence: filters.confidence,
      query: filters.query,
    },
    operations: limitedOperations.map((node) => ({
      id: node.id,
      kind: node.kind,
      method: node.method,
      path: node.path,
      operationId: node.operationId,
      risk: node.risk,
      findingCount: node.findingCount,
      evidenceTruncated: node.evidenceTruncated,
      findings: node.findings,
    })),
    files,
    edges,
    summary: {
      operationCount: limitedOperations.length,
      fileCount: files.length,
      relationCount: edges.length,
      findingCount: limitedOperations.reduce((sum, node) => sum + node.findingCount, 0),
      impactCount: edges.reduce((sum, edge) => sum + edge.impactCount, 0),
      unmappedFindingCount,
      unmatchedImpactCount,
      totalOperationCount,
      totalFileCount,
      totalRelationCount,
      truncated,
    },
    limitations,
  };
}

type OperationDraft = {
  key: string;
  method: string;
  path: string;
  findings: FindingLike[];
  operationId: string | null;
  matchesQuery: boolean;
};

type OperationNodeWithKey = ImpactGraphOperationNode & { key: string };

type ImpactDraft = {
  impact: ImpactLike;
  key: string;
  matchesQuery: boolean;
};

type EdgeDraft = {
  key: string;
  operationId: string;
  filePath: string;
  fileId: string;
  impacts: ImpactLike[];
};

function resolveFilters(filters: ImpactGraphFilters | undefined): ResolvedFilters {
  const category = (filters?.category ?? "all").trim();
  const method = (filters?.method ?? "all").trim().toLowerCase();
  return {
    risk: filters?.risk ?? "all",
    category: category.length > 0 ? category : "all",
    method: method.length > 0 ? method : "all",
    confidence: filters?.confidence ?? "all",
    query: (filters?.query ?? "").trim().toLowerCase(),
  };
}

function operationKey(method: string, path: string): string {
  return `${method} ${path}`;
}

function matchesQueryText(
  query: string,
  values: ReadonlyArray<string | null | undefined>,
): boolean {
  if (query.length === 0) {
    return true;
  }
  return values.some(
    (value) => typeof value === "string" && value.toLowerCase().includes(query),
  );
}

function highestRisk(findings: readonly FindingLike[]): GraphRiskLevel {
  let best: GraphRiskLevel = "non_breaking";
  for (const finding of findings) {
    if (RISK_RANK[finding.risk] > RISK_RANK[best]) {
      best = finding.risk;
    }
  }
  return best;
}

function highestConfidence(impacts: readonly ImpactLike[]): GraphConfidence {
  let best: GraphConfidence = "low";
  for (const impact of impacts) {
    if (CONFIDENCE_RANK[impact.confidence] > CONFIDENCE_RANK[best]) {
      best = impact.confidence;
    }
  }
  return best;
}

function compareById(a: { id: string }, b: { id: string }): number {
  return a.id.localeCompare(b.id);
}

function compareOperationNodes(a: OperationNodeWithKey, b: OperationNodeWithKey): number {
  const risk = RISK_RANK[b.risk] - RISK_RANK[a.risk];
  if (risk !== 0) {
    return risk;
  }
  const findingCount = b.findingCount - a.findingCount;
  if (findingCount !== 0) {
    return findingCount;
  }
  const method = a.method.localeCompare(b.method);
  return method !== 0 ? method : a.path.localeCompare(b.path);
}

function compareEdgeDrafts(a: EdgeDraft, b: EdgeDraft): number {
  const impactCount = b.impacts.length - a.impacts.length;
  if (impactCount !== 0) {
    return impactCount;
  }
  const source = a.operationId.localeCompare(b.operationId);
  return source !== 0 ? source : a.filePath.localeCompare(b.filePath);
}

function toFindingEvidence(finding: FindingLike): ImpactGraphFindingEvidence {
  return {
    id: finding.id,
    category: finding.category,
    changeType: finding.changeType,
    risk: finding.risk,
    location: finding.location,
    summary: finding.summary,
  };
}

function toImpactEvidence(impact: ImpactLike): ImpactGraphImpactEvidence {
  return {
    id: impact.id,
    filePath: impact.filePath,
    line: impact.line,
    column: impact.column,
    snippet: impact.snippet,
    call: impact.call,
    path: impact.path,
    method: impact.method,
    confidence: impact.confidence,
    evidence: impact.evidence,
  };
}
