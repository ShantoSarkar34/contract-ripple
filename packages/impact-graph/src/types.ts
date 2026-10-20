/**
 * Types for the ContractRipple impact graph.
 *
 * The graph connects changed OpenAPI operations (derived from comparison
 * findings) to source files (derived from persisted source-impact evidence).
 * Every node and edge carries the analysis evidence it was built from; the
 * builder never invents a relationship that is not present in the inputs.
 */

export const GRAPH_RISK_LEVELS = ["non_breaking", "potentially_breaking", "unknown"] as const;
export type GraphRiskLevel = (typeof GRAPH_RISK_LEVELS)[number];

export const GRAPH_CONFIDENCES = ["high", "medium", "low"] as const;
export type GraphConfidence = (typeof GRAPH_CONFIDENCES)[number];

export const IMPACT_GRAPH_LIMITS = {
  /** Maximum number of changed operations rendered in one graph. */
  maxOperations: 200,
  /** Maximum number of affected source files rendered in one graph. */
  maxFiles: 400,
  /** Maximum number of operation-to-file relationships rendered. */
  maxEdges: 800,
  /** Maximum evidence entries embedded in one node or relationship. */
  maxEvidencePerRelation: 20,
} as const;
export type ImpactGraphLimits = typeof IMPACT_GRAPH_LIMITS;

/** The subset of a comparison finding the graph builder reads. */
export type FindingLike = {
  id: string;
  category: string;
  changeType: string;
  risk: GraphRiskLevel;
  path: string | null;
  method: string | null;
  operationId: string | null;
  location: string;
  summary: string;
};

/** The subset of a persisted source impact the graph builder reads. */
export type ImpactLike = {
  id: string;
  filePath: string;
  line: number;
  column: number;
  snippet: string;
  call: string;
  /** HTTP method inferred from the detected call. */
  method: string;
  /** Request path inferred from the detected call. */
  path: string;
  matchedMethod: string;
  matchedPath: string;
  operationId: string | null;
  confidence: GraphConfidence;
  evidence: string;
};

/** Source snapshot metadata attached to the graph; `null` when none is selected. */
export type ImpactGraphSource = {
  snapshotId: string;
  sourceType: "zip" | "github";
  repository: string | null;
  ref: string | null;
  createdAt: string;
} | null;

export type ImpactGraphFilters = {
  risk?: GraphRiskLevel | "all";
  category?: string | "all";
  method?: string | "all";
  confidence?: GraphConfidence | "all";
  query?: string;
};

export type ImpactGraphFindingEvidence = {
  id: string;
  category: string;
  changeType: string;
  risk: GraphRiskLevel;
  location: string;
  summary: string;
};

export type ImpactGraphImpactEvidence = {
  id: string;
  filePath: string;
  line: number;
  column: number;
  snippet: string;
  call: string;
  path: string;
  method: string;
  confidence: GraphConfidence;
  evidence: string;
};

export type ImpactGraphOperationNode = {
  id: string;
  kind: "operation";
  method: string;
  path: string;
  operationId: string | null;
  risk: GraphRiskLevel;
  findingCount: number;
  evidenceTruncated: boolean;
  findings: ImpactGraphFindingEvidence[];
};

export type ImpactGraphFileNode = {
  id: string;
  kind: "file";
  filePath: string;
  impactCount: number;
  highestConfidence: GraphConfidence;
};

export type ImpactGraphEdge = {
  id: string;
  source: string;
  target: string;
  impactCount: number;
  highestConfidence: GraphConfidence;
  evidenceTruncated: boolean;
  impacts: ImpactGraphImpactEvidence[];
};

export type ImpactGraphSummary = {
  /** Changed operations rendered after filters and limits. */
  operationCount: number;
  /** Affected files rendered after filters and limits. */
  fileCount: number;
  /** Operation-to-file relationships rendered after filters and limits. */
  relationCount: number;
  /** Findings represented by the rendered operations. */
  findingCount: number;
  /** Source matches represented by the rendered relationships. */
  impactCount: number;
  /** Findings without a method and path that cannot be placed on the graph. */
  unmappedFindingCount: number;
  /** Source matches that did not correspond to a shown changed operation. */
  unmatchedImpactCount: number;
  /** Changed operations available before limits were applied. */
  totalOperationCount: number;
  /** Affected files available before limits were applied. */
  totalFileCount: number;
  /** Relationships available before limits were applied. */
  totalRelationCount: number;
  /** True when any node, relationship, or evidence list was limited. */
  truncated: boolean;
};

export type ImpactGraph = {
  source: ImpactGraphSource;
  filters: {
    risk: GraphRiskLevel | "all";
    category: string | "all";
    method: string | "all";
    confidence: GraphConfidence | "all";
    query: string;
  };
  operations: ImpactGraphOperationNode[];
  files: ImpactGraphFileNode[];
  edges: ImpactGraphEdge[];
  summary: ImpactGraphSummary;
  limitations: string[];
};

export type ImpactGraphOptions = {
  source?: ImpactGraphSource;
  filters?: ImpactGraphFilters;
  limits?: Partial<ImpactGraphLimits>;
};

export type ImpactGraphFilterValues = {
  risks: GraphRiskLevel[];
  categories: string[];
  methods: string[];
  confidences: GraphConfidence[];
};
