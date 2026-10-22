"use client";

import { Fragment, useMemo, useState } from "react";
import type { AnalysisRunDetailDto, SourceSnapshotDetailDto } from "@contract-ripple/shared";
import {
  buildImpactGraph,
  collectFilterValues,
  type GraphConfidence,
  type GraphRiskLevel,
  type ImpactGraph,
  type ImpactGraphEdge,
  type ImpactGraphFileNode,
  type ImpactGraphOperationNode,
} from "@contract-ripple/impact-graph";
import {
  CATEGORY_LABELS,
  CONFIDENCE_CLASSES,
  CONFIDENCE_LABELS,
  RISK_BADGE_CLASSES,
  RISK_LABELS,
  displayPath,
  methodClass,
} from "@/lib/findings";

const NODE_WIDTH = 236;
const NODE_HEIGHT = 60;
const COLUMN_GAP = 190;
const PADDING_X = 20;
const PADDING_Y = 20;
const ROW_GAP = 16;

const RISK_ACCENT: Record<GraphRiskLevel, string> = {
  potentially_breaking: "fill-danger",
  unknown: "fill-warning",
  non_breaking: "fill-success",
};

const EDGE_STROKE: Record<GraphConfidence, string> = {
  high: "stroke-primary",
  medium: "stroke-warning",
  low: "stroke-subtle",
};

type GraphFilterState = {
  risk: GraphRiskLevel | "all";
  category: string | "all";
  method: string | "all";
  confidence: GraphConfidence | "all";
  query: string;
};

const DEFAULT_FILTERS: GraphFilterState = {
  risk: "all",
  category: "all",
  method: "all",
  confidence: "all",
  query: "",
};

type GraphSelection = {
  kind: "operation" | "file" | "impact";
  id: string;
};

/** The evidence fields shared by persisted impacts and graph impact evidence. */
type ImpactEvidence = {
  id: string;
  filePath: string;
  confidence: GraphConfidence;
  line: number;
  column: number;
  call: string;
  snippet: string;
  evidence: string;
};

type SelectedImpact = {
  impact: ImpactEvidence;
  edge: ImpactGraphEdge;
};

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category;
}

function fileName(filePath: string): string {
  const normalized = displayPath(filePath);
  const slash = normalized.lastIndexOf("/");
  return slash === -1 ? normalized : normalized.slice(slash + 1);
}

function directoryName(filePath: string): string {
  const normalized = displayPath(filePath);
  const slash = normalized.lastIndexOf("/");
  return slash <= 0 ? "repository root" : normalized.slice(0, slash);
}

function operationLabelFromSource(source: string): string {
  const value = source.replace(/^operation:/, "");
  const separator = value.indexOf(" ");
  return separator === -1
    ? value
    : `${value.slice(0, separator).toUpperCase()} ${value.slice(separator + 1)}`;
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

function filtersAreActive(filters: GraphFilterState): boolean {
  return (
    filters.risk !== "all" ||
    filters.category !== "all" ||
    filters.method !== "all" ||
    filters.confidence !== "all" ||
    filters.query.trim().length > 0
  );
}

function findSelectedImpact(
  graph: ImpactGraph,
  selection: GraphSelection | null,
): SelectedImpact | null {
  if (selection?.kind !== "impact") {
    return null;
  }
  for (const edge of graph.edges) {
    const impact = edge.impacts.find((candidate) => candidate.id === selection.id);
    if (impact) {
      return { impact, edge };
    }
  }
  return null;
}

export default function ImpactGraph({
  analysis,
  snapshot,
}: {
  analysis: AnalysisRunDetailDto;
  snapshot: SourceSnapshotDetailDto;
}) {
  const [filters, setFilters] = useState<GraphFilterState>(DEFAULT_FILTERS);
  const [view, setView] = useState<"map" | "list">("map");
  const [selection, setSelection] = useState<GraphSelection | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const filterValues = useMemo(
    () => collectFilterValues(analysis.findings, snapshot.impacts),
    [analysis.findings, snapshot.impacts],
  );

  const graph = useMemo(
    () =>
      buildImpactGraph(analysis.findings, snapshot.impacts, {
        source: {
          snapshotId: snapshot.id,
          sourceType: snapshot.sourceType,
          repository: snapshot.repository,
          ref: snapshot.ref,
          createdAt: snapshot.createdAt,
        },
        filters,
      }),
    [
      analysis.findings,
      snapshot.impacts,
      snapshot.id,
      snapshot.sourceType,
      snapshot.repository,
      snapshot.ref,
      snapshot.createdAt,
      filters,
    ],
  );

  const layout = useMemo(() => {
    const rows = Math.max(graph.operations.length, graph.files.length, 1);
    const width = PADDING_X * 2 + NODE_WIDTH * 2 + COLUMN_GAP;
    const height = PADDING_Y * 2 + rows * NODE_HEIGHT + (rows - 1) * ROW_GAP;
    const operationPositions = new Map<string, { x: number; y: number }>();
    const filePositions = new Map<string, { x: number; y: number }>();

    graph.operations.forEach((operation, index) => {
      operationPositions.set(operation.id, {
        x: PADDING_X,
        y: PADDING_Y + index * (NODE_HEIGHT + ROW_GAP),
      });
    });
    graph.files.forEach((file, index) => {
      filePositions.set(file.id, {
        x: PADDING_X + NODE_WIDTH + COLUMN_GAP,
        y: PADDING_Y + index * (NODE_HEIGHT + ROW_GAP),
      });
    });

    return { width, height, operationPositions, filePositions };
  }, [graph.operations, graph.files]);

  const selectedOperation =
    selection?.kind === "operation"
      ? (graph.operations.find((operation) => operation.id === selection.id) ?? null)
      : null;
  const selectedFile =
    selection?.kind === "file"
      ? (graph.files.find((file) => file.id === selection.id) ?? null)
      : null;
  const selectedImpact = findSelectedImpact(graph, selection);

  const selectedFileImpacts: ImpactEvidence[] = selectedFile
    ? graph.edges
        .filter((edge) => edge.target === selectedFile.id)
        .flatMap((edge) => edge.impacts)
    : [];

  const selectedNodeId =
    selection?.kind === "operation" || selection?.kind === "file" ? selection.id : null;
  const activeNodeId = hoveredId ?? selectedNodeId;
  const hasSelection = activeNodeId !== null || selectedImpact !== null;
  const activeSummary = selectedOperation
    ? `Evidence for ${selectedOperation.method.toUpperCase()} ${selectedOperation.path}`
    : selectedFile
      ? `Evidence for ${displayPath(selectedFile.filePath)}`
      : selectedImpact
        ? `Evidence for ${displayPath(selectedImpact.impact.filePath)}, line ${selectedImpact.impact.line}`
        : "";

  function updateFilter<K extends keyof GraphFilterState>(
    key: K,
    value: GraphFilterState[K],
  ): void {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function isEdgeActive(edge: ImpactGraphEdge): boolean {
    if (selectedImpact?.edge.id === edge.id) {
      return true;
    }
    return activeNodeId !== null && (edge.source === activeNodeId || edge.target === activeNodeId);
  }

  const summaryText = `${graph.summary.operationCount} changed operation(s) · ${graph.summary.fileCount} affected file(s) · ${graph.summary.relationCount} evidence relationship(s)`;
  const activeFilters = filtersAreActive(filters);

  return (
    <section aria-labelledby="impact-graph-heading" className="mt-6 border-t border-line pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 id="impact-graph-heading" className="text-base font-semibold text-foreground">
            Impact map
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Changed API operations linked to source files by persisted static-analysis matches.
            Every line represents evidence from this snapshot.
          </p>
        </div>
        <div className="inline-flex rounded-md border border-line p-0.5" role="group" aria-label="Impact map view">
          <button
            type="button"
            className={`min-h-11 rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
              view === "map" ? "bg-primary text-on-primary" : "text-muted hover:bg-surface-strong"
            }`}
            aria-pressed={view === "map"}
            onClick={() => setView("map")}
          >
            Map
          </button>
          <button
            type="button"
            className={`min-h-11 rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
              view === "list" ? "bg-primary text-on-primary" : "text-muted hover:bg-surface-strong"
            }`}
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            Relationships
          </button>
        </div>
      </div>

      <div
        role="group"
        aria-label="Impact map filters"
        className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
      >
        <label className="text-xs font-medium text-muted">
          Risk
          <select
            className="input mt-1"
            value={filters.risk}
            onChange={(event) =>
              updateFilter("risk", event.target.value as GraphFilterState["risk"])
            }
          >
            <option value="all">All risk levels</option>
            {filterValues.risks.map((risk) => (
              <option key={risk} value={risk}>
                {RISK_LABELS[risk]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-muted">
          Category
          <select
            className="input mt-1"
            value={filters.category}
            onChange={(event) => updateFilter("category", event.target.value)}
          >
            <option value="all">All categories</option>
            {filterValues.categories.map((category) => (
              <option key={category} value={category}>
                {categoryLabel(category)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-muted">
          Method
          <select
            className="input mt-1"
            value={filters.method}
            onChange={(event) => updateFilter("method", event.target.value)}
          >
            <option value="all">All methods</option>
            {filterValues.methods.map((method) => (
              <option key={method} value={method}>
                {method.toUpperCase()}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-muted">
          Match confidence
          <select
            className="input mt-1"
            value={filters.confidence}
            onChange={(event) =>
              updateFilter("confidence", event.target.value as GraphFilterState["confidence"])
            }
          >
            <option value="all">All confidence levels</option>
            {filterValues.confidences.map((confidence) => (
              <option key={confidence} value={confidence}>
                {CONFIDENCE_LABELS[confidence]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-muted">
          Search
          <input
            type="search"
            className="input mt-1"
            placeholder="Operation, path, or file"
            value={filters.query}
            onChange={(event) => updateFilter("query", event.target.value)}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-subtle" aria-live="polite">
          {summaryText}
          {graph.summary.truncated ? " · limited view" : ""}
        </p>
        {activeFilters ? (
          <button
            type="button"
            className="inline-flex min-h-11 items-center text-xs font-semibold text-primary underline-offset-2 hover:underline"
            onClick={() => setFilters(DEFAULT_FILTERS)}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {graph.limitations.length > 0 ? (
        <details className="mt-3 rounded-md border border-line p-3 text-sm">
          <summary className="min-h-11 cursor-pointer py-2 font-medium text-foreground">
            Graph limitations ({graph.limitations.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            {graph.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {graph.operations.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-line-strong p-4 text-sm text-subtle">
          No changed operations are available for this view. Adjust or clear the filters to see
          the evidence-backed graph.
        </p>
      ) : view === "map" ? (
        <div className="mt-4">
          <p className="text-xs text-subtle">
            The map is a visual view. The Relationships view contains the same evidence in a
            keyboard- and screen-reader-friendly table.
          </p>
          <div
            role="region"
            aria-label="Impact map, visual only. Use the Relationships view for the accessible data table."
            tabIndex={0}
            className="mt-2 overflow-x-auto rounded-md border border-line bg-surface-muted/60 p-2"
          >
            <svg
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              className="h-auto w-full min-w-[680px]"
              aria-hidden="true"
              focusable="false"
            >
              <title>Impact map</title>
              <desc>
                Changed API operations on the left, affected source files on the right. Lines
                represent persisted source matches from this snapshot.
              </desc>
              {graph.edges.map((edge) => {
                const from = layout.operationPositions.get(edge.source);
                const to = layout.filePositions.get(edge.target);
                if (!from || !to) {
                  return null;
                }
                const x1 = from.x + NODE_WIDTH;
                const y1 = from.y + NODE_HEIGHT / 2;
                const x2 = to.x;
                const y2 = to.y + NODE_HEIGHT / 2;
                const active = isEdgeActive(edge);
                const dimmed = hasSelection && !active;
                return (
                  <path
                    key={edge.id}
                    d={`M ${x1} ${y1} C ${x1 + 70} ${y1}, ${x2 - 70} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    strokeWidth={active ? 2.5 : 1.5}
                    strokeDasharray={
                      edge.highestConfidence === "medium"
                        ? "6 4"
                        : edge.highestConfidence === "low"
                          ? "2 4"
                          : undefined
                    }
                    className={`${EDGE_STROKE[edge.highestConfidence]} transition-opacity ${
                      dimmed ? "opacity-20" : "opacity-90"
                    }`}
                  >
                    <title>
                      {`${edge.impactCount} source match(es), ${CONFIDENCE_LABELS[edge.highestConfidence]} confidence`}
                    </title>
                  </path>
                );
              })}

              {graph.operations.map((operation) => {
                const position = layout.operationPositions.get(operation.id);
                if (!position) {
                  return null;
                }
                return (
                  <MapOperationNode
                    key={operation.id}
                    operation={operation}
                    position={position}
                    selected={selectedNodeId === operation.id}
                    onSelect={() => setSelection({ kind: "operation", id: operation.id })}
                    onHover={setHoveredId}
                  />
                );
              })}

              {graph.files.map((file) => {
                const position = layout.filePositions.get(file.id);
                if (!position) {
                  return null;
                }
                return (
                  <MapFileNode
                    key={file.id}
                    file={file}
                    position={position}
                    selected={selectedNodeId === file.id}
                    onSelect={() => setSelection({ kind: "file", id: file.id })}
                    onHover={setHoveredId}
                  />
                );
              })}
            </svg>
          </div>
          <GraphLegend />
        </div>
      ) : (
        <RelationshipsTable
          graph={graph}
          selectedImpactId={selectedImpact?.impact.id ?? null}
          onSelectImpact={(impactId) => setSelection({ kind: "impact", id: impactId })}
          onSelectOperation={(operationId) => setSelection({ kind: "operation", id: operationId })}
          onSelectFile={(fileId) => setSelection({ kind: "file", id: fileId })}
        />
      )}

      <p className="sr-only" aria-live="polite">
        {activeSummary}
      </p>

      <EvidenceDetail
        selectedOperation={selectedOperation}
        selectedFile={selectedFile}
        selectedFileImpacts={selectedFileImpacts}
        selectedImpact={selectedImpact}
      />
    </section>
  );
}

function MapOperationNode({
  operation,
  position,
  selected,
  onSelect,
  onHover,
}: {
  operation: ImpactGraphOperationNode;
  position: { x: number; y: number };
  selected: boolean;
  onSelect: () => void;
  onHover: (id: string | null) => void;
}) {
  const visiblePath = truncate(operation.path, 31);
  const visibleMeta = `${operation.findingCount} finding(s) · ${RISK_LABELS[operation.risk]}`;

  return (
    <g
      transform={`translate(${position.x}, ${position.y})`}
      className="map-node cursor-pointer"
      onClick={onSelect}
      onMouseEnter={() => onHover(operation.id)}
      onMouseLeave={() => onHover(null)}
    >
      <rect
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx={8}
        className={`fill-surface ${selected ? "stroke-primary" : "stroke-line"}`}
        strokeWidth={selected ? 2 : 1}
      />
      <rect width={4} height={NODE_HEIGHT} rx={2} className={RISK_ACCENT[operation.risk]} />
      <text x={14} y={19} className="fill-foreground text-[11px] font-bold uppercase">
        {operation.method}
      </text>
      <text x={14} y={37} className="fill-foreground font-mono text-[11px]">
        {visiblePath}
      </text>
      <text x={14} y={52} className="fill-subtle text-[10px]">
        {visibleMeta}
      </text>
    </g>
  );
}

function MapFileNode({
  file,
  position,
  selected,
  onSelect,
  onHover,
}: {
  file: ImpactGraphFileNode;
  position: { x: number; y: number };
  selected: boolean;
  onSelect: () => void;
  onHover: (id: string | null) => void;
}) {
  const visibleName = truncate(fileName(file.filePath), 30);
  const visibleDirectory = truncate(directoryName(file.filePath), 34);
  const visibleMeta = `${file.impactCount} match(es) · ${CONFIDENCE_LABELS[file.highestConfidence]} confidence`;

  return (
    <g
      transform={`translate(${position.x}, ${position.y})`}
      className="map-node cursor-pointer"
      onClick={onSelect}
      onMouseEnter={() => onHover(file.id)}
      onMouseLeave={() => onHover(null)}
    >
      <rect
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx={8}
        className={`fill-surface ${selected ? "stroke-primary" : "stroke-line"}`}
        strokeWidth={selected ? 2 : 1}
      />
      <rect width={4} height={NODE_HEIGHT} rx={2} className="fill-primary" />
      <text x={14} y={22} className="fill-foreground text-[11px] font-semibold">
        {visibleName}
      </text>
      <text x={14} y={38} className="fill-subtle font-mono text-[9px]">
        {visibleDirectory}
      </text>
      <text x={14} y={52} className="fill-subtle text-[10px]">
        {visibleMeta}
      </text>
    </g>
  );
}

function GraphLegend() {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-subtle">
      <li className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-danger" aria-hidden="true" />
        Potentially breaking operation
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-warning" aria-hidden="true" />
        Unknown risk
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-success" aria-hidden="true" />
        Non-breaking operation
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-6 bg-primary" aria-hidden="true" />
        High confidence match
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-6 border-t border-dashed border-warning" aria-hidden="true" />
        Medium confidence match
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-6 border-t border-dotted border-line-strong" aria-hidden="true" />
        Low confidence match
      </li>
    </ul>
  );
}

function RelationshipCards({
  graph,
  selectedImpactId,
  onSelectImpact,
  onSelectOperation,
  onSelectFile,
}: {
  graph: ImpactGraph;
  selectedImpactId: string | null;
  onSelectImpact: (impactId: string) => void;
  onSelectOperation: (operationId: string) => void;
  onSelectFile: (fileId: string) => void;
}) {
  return (
    <ul className="mt-4 space-y-3 lg:hidden" aria-label="Evidence-backed relationships">
      {graph.operations.map((operation) => {
        const edges = graph.edges.filter((edge) => edge.source === operation.id);
        return (
          <li key={operation.id} className="rounded-lg border border-line bg-surface p-4">
            <OperationIdentity
              operation={operation}
              onSelect={() => onSelectOperation(operation.id)}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className={`badge ${RISK_BADGE_CLASSES[operation.risk]}`}>
                {RISK_LABELS[operation.risk]}
              </span>
              <span className="text-muted">{operation.findingCount} finding(s)</span>
            </div>

            {edges.length === 0 ? (
              <div className="mt-3 border-t border-line pt-3">
                <p className="text-xs font-semibold text-subtle">No persisted source match</p>
                <p className="mt-1 text-xs leading-5 text-subtle">
                  Static analysis found no resolvable call for this operation.
                </p>
              </div>
            ) : (
              <ul className="mt-3 space-y-3 border-t border-line pt-3">
                {edges.map((edge) => {
                  const file = graph.files.find((candidate) => candidate.id === edge.target);
                  const firstImpact = edge.impacts[0];
                  return (
                    <li key={edge.id}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
                        Source file
                      </p>
                      <button
                        type="button"
                        className="mt-1 min-h-11 break-all text-left font-mono text-xs text-primary underline-offset-2 hover:underline"
                        onClick={() => onSelectFile(edge.target)}
                      >
                        {displayPath(file?.filePath ?? edge.target.replace(/^file:/, ""))}
                      </button>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span className={`font-semibold ${CONFIDENCE_CLASSES[edge.highestConfidence]}`}>
                          {CONFIDENCE_LABELS[edge.highestConfidence]} confidence
                        </span>
                        <span className="text-subtle">{edge.impactCount} call(s)</span>
                        {firstImpact ? (
                          <button
                            type="button"
                            className="min-h-11 text-left text-xs text-muted underline-offset-2 hover:text-primary hover:underline"
                            onClick={() => onSelectImpact(firstImpact.id)}
                          >
                            Line {firstImpact.line}, column {firstImpact.column}
                            {edge.evidenceTruncated ? " · more matches" : ""}
                          </button>
                        ) : (
                          <span className="text-xs text-subtle">Evidence unavailable</span>
                        )}
                      </div>
                      <p className="mt-1 break-all font-mono text-[11px] text-subtle">
                        {truncate(firstImpact?.snippet ?? "", 100)}
                      </p>
                      {selectedImpactId && firstImpact?.id === selectedImpactId ? (
                        <p className="mt-1 text-[11px] font-semibold text-primary">Selected</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function RelationshipsTable({
  graph,
  selectedImpactId,
  onSelectImpact,
  onSelectOperation,
  onSelectFile,
}: {
  graph: ImpactGraph;
  selectedImpactId: string | null;
  onSelectImpact: (impactId: string) => void;
  onSelectOperation: (operationId: string) => void;
  onSelectFile: (fileId: string) => void;
}) {
  return (
    <>
      <RelationshipCards
        graph={graph}
        selectedImpactId={selectedImpactId}
        onSelectImpact={onSelectImpact}
        onSelectOperation={onSelectOperation}
        onSelectFile={onSelectFile}
      />
      <div
        role="region"
        aria-label="Evidence-backed relationships table, horizontally scrollable"
        tabIndex={0}
        className="mt-4 hidden overflow-x-auto rounded-md border border-line lg:block"
      >
        <table className="w-full min-w-[820px] text-left text-sm">
        <caption className="sr-only">
          Changed API operations and their affected source files. This table contains the same
          evidence-backed relationships as the impact map.
        </caption>
        <thead className="bg-surface-muted text-xs uppercase tracking-wide text-subtle">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Operation</th>
            <th scope="col" className="px-3 py-2 font-semibold">Risk</th>
            <th scope="col" className="px-3 py-2 font-semibold">Findings</th>
            <th scope="col" className="px-3 py-2 font-semibold">Source file</th>
            <th scope="col" className="px-3 py-2 font-semibold">Confidence</th>
            <th scope="col" className="px-3 py-2 font-semibold">Evidence</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {graph.operations.map((operation) => {
            const edges = graph.edges.filter((edge) => edge.source === operation.id);
            if (edges.length === 0) {
              return (
                <tr key={operation.id} className="align-top">
                  <td className="px-3 py-3">
                    <OperationIdentity
                      operation={operation}
                      onSelect={() => onSelectOperation(operation.id)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <span className={`badge ${RISK_BADGE_CLASSES[operation.risk]}`}>
                      {RISK_LABELS[operation.risk]}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-muted">
                    {operation.findingCount}
                  </td>
                  <td className="px-3 py-3 text-subtle">
                    No persisted source match
                  </td>
                  <td className="px-3 py-3 text-subtle">—</td>
                  <td className="px-3 py-3 text-subtle">
                    Static analysis found no resolvable call for this operation.
                  </td>
                </tr>
              );
            }

            return (
              <Fragment key={operation.id}>
                {edges.map((edge, index) => {
                  const file = graph.files.find((candidate) => candidate.id === edge.target);
                  const firstImpact = edge.impacts[0];
                  return (
                    <tr key={edge.id} className="align-top">
                      {index === 0 ? (
                        <>
                          <td className="px-3 py-3" rowSpan={edges.length}>
                            <OperationIdentity
                              operation={operation}
                              onSelect={() => onSelectOperation(operation.id)}
                            />
                          </td>
                          <td className="px-3 py-3" rowSpan={edges.length}>
                            <span className={`badge ${RISK_BADGE_CLASSES[operation.risk]}`}>
                              {RISK_LABELS[operation.risk]}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-muted" rowSpan={edges.length}>
                            {operation.findingCount}
                          </td>
                        </>
                      ) : null}
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          className="min-h-11 break-all text-left font-mono text-xs text-primary underline-offset-2 hover:underline"
                          onClick={() => onSelectFile(edge.target)}
                        >
                          {displayPath(file?.filePath ?? edge.target.replace(/^file:/, ""))}
                        </button>
                        <span className="mt-1 block text-xs text-subtle">
                          {edge.impactCount} call(s)
                        </span>
                      </td>
                      <td className={`px-3 py-3 text-xs font-semibold ${CONFIDENCE_CLASSES[edge.highestConfidence]}`}>
                        {CONFIDENCE_LABELS[edge.highestConfidence]}
                      </td>
                      <td className="px-3 py-3">
                        {firstImpact ? (
                          <button
                            type="button"
                            className="min-h-11 text-left text-xs text-muted underline-offset-2 hover:text-primary hover:underline"
                            onClick={() => onSelectImpact(firstImpact.id)}
                          >
                            Line {firstImpact.line}, column {firstImpact.column}
                            {edge.evidenceTruncated ? " · more matches" : ""}
                          </button>
                        ) : (
                          <span className="text-xs text-subtle">
                            Evidence unavailable
                          </span>
                        )}
                        <span className="mt-1 block break-all font-mono text-[11px] text-subtle">
                          {truncate(firstImpact?.snippet ?? "", 80)}
                        </span>
                        {selectedImpactId && firstImpact?.id === selectedImpactId ? (
                          <span className="mt-1 block text-[11px] font-semibold text-primary">
                            Selected
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      </div>
    </>
  );
}

function OperationIdentity({
  operation,
  onSelect,
}: {
  operation: ImpactGraphOperationNode;
  onSelect: () => void;
}) {
  return (
    <button type="button" className="group min-h-11 text-left" onClick={onSelect}>
      <span className="flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold uppercase ${methodClass(operation.method)}`}
        >
          {operation.method}
        </span>
        <span className="break-all font-mono text-xs font-semibold text-foreground group-hover:text-primary">
          {operation.path}
        </span>
      </span>
      {operation.operationId ? (
        <span className="mt-1 block text-[11px] text-subtle">
          operationId <span className="font-mono">{operation.operationId}</span>
        </span>
      ) : null}
    </button>
  );
}

function EvidenceDetail({
  selectedOperation,
  selectedFile,
  selectedFileImpacts,
  selectedImpact,
}: {
  selectedOperation: ImpactGraphOperationNode | null;
  selectedFile: ImpactGraphFileNode | null;
  selectedFileImpacts: ImpactEvidence[];
  selectedImpact: SelectedImpact | null;
}) {
  if (!selectedOperation && !selectedFile && !selectedImpact) {
    return (
      <p className="mt-3 rounded-md border border-dashed border-line-strong p-3 text-xs text-subtle">
        Select an operation or file in the map, or a row in the Relationships table, to inspect the
        underlying comparison findings and source evidence.
      </p>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-line bg-surface-muted/60 p-3">
      {selectedOperation ? (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold uppercase ${methodClass(selectedOperation.method)}`}
            >
              {selectedOperation.method}
            </span>
            <h4 className="break-all font-mono text-sm font-semibold text-foreground">
              {selectedOperation.path}
            </h4>
            <span className={`badge ${RISK_BADGE_CLASSES[selectedOperation.risk]}`}>
              {RISK_LABELS[selectedOperation.risk]}
            </span>
          </div>
          <p className="mt-1 text-xs text-subtle">
            {selectedOperation.operationId
              ? `operationId ${selectedOperation.operationId} · `
              : ""}
            {selectedOperation.findingCount} comparison finding(s)
            {selectedOperation.evidenceTruncated ? " · list truncated in the map" : ""}
          </p>
          <ul className="mt-2 space-y-2">
            {selectedOperation.findings.map((finding) => (
              <li key={finding.id} className="rounded-md border border-line bg-surface p-2">
                <p className="text-xs font-medium text-foreground">{finding.summary}</p>
                <p className="mt-1 text-[11px] text-subtle">
                  {categoryLabel(finding.category)} · {finding.changeType} ·{" "}
                  <span className="break-all font-mono">{finding.location}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {selectedFile ? (
        <div>
          <h4 className="break-all font-mono text-sm font-semibold text-foreground">
            {displayPath(selectedFile.filePath)}
          </h4>
          <p className="mt-1 text-xs text-subtle">
            {selectedFile.impactCount} source match(es) ·{" "}
            {CONFIDENCE_LABELS[selectedFile.highestConfidence]} confidence
          </p>
          <ul className="mt-2 space-y-2">
            {selectedFileImpacts.map((impact) => (
              <ImpactEvidenceItem key={impact.id} impact={impact} />
            ))}
          </ul>
        </div>
      ) : null}

      {selectedImpact ? (
        <div>
          <p className="text-xs text-subtle">
            Matched operation{" "}
            <span className="font-mono font-semibold text-foreground">
              {operationLabelFromSource(selectedImpact.edge.source)}
            </span>
          </p>
          <ul className="mt-2">
            <ImpactEvidenceItem impact={selectedImpact.impact} />
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ImpactEvidenceItem({ impact }: { impact: ImpactEvidence }) {
  return (
    <li className="rounded-md border border-line bg-surface p-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`font-semibold ${CONFIDENCE_CLASSES[impact.confidence]}`}>
          {CONFIDENCE_LABELS[impact.confidence]} confidence
        </span>
        <span className="text-subtle">
          line {impact.line}, column {impact.column}
        </span>
        <span className="ml-auto break-all font-mono text-[11px] text-subtle">
          {impact.call}
        </span>
      </div>
      <pre
        tabIndex={0}
        aria-label="Source evidence snippet"
        className="mt-2 overflow-x-auto rounded bg-surface-muted p-2 font-mono text-[11px] text-foreground"
      >
        {impact.snippet}
      </pre>
      <p className="mt-1 text-[11px] text-subtle">{impact.evidence}</p>
    </li>
  );
}
