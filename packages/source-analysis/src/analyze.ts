import ts from "typescript";
import {
  HTTP_METHODS,
  SOURCE_ANALYSIS_LIMITS,
  SourceAnalysisError,
  type ChangedOperation,
  type HttpMethod,
  type SourceAnalysisOptions,
  type SourceAnalysisResult,
  type SourceFileInput,
  type SourceMatch,
} from "./types.js";
import {
  isIgnoredSourcePath,
  isSupportedSourcePath,
  matchOperation,
  normalizeCallPath,
} from "./paths.js";

const STATIC_ANALYSIS_LIMITATION =
  "Static analysis only detects API calls whose HTTP method and path are statically resolvable. Dynamic URLs, custom wrappers, generated clients, and runtime behavior can hide affected integrations.";

type ExtractedPath = {
  path: string;
  dynamic: boolean;
};

function isHttpMethod(value: string): value is HttpMethod {
  return (HTTP_METHODS as readonly string[]).includes(value);
}

function scriptKindFor(path: string): ts.ScriptKind {
  const lower = path.toLowerCase();
  if (lower.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }
  if (lower.endsWith(".jsx")) {
    return ts.ScriptKind.JSX;
  }
  if (lower.endsWith(".ts") || lower.endsWith(".mts") || lower.endsWith(".cts")) {
    return ts.ScriptKind.TS;
  }
  return ts.ScriptKind.JS;
}

function readPathArgument(node: ts.Expression | undefined): ExtractedPath | null {
  if (!node) {
    return null;
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return { path: node.text, dynamic: false };
  }
  if (ts.isTemplateExpression(node)) {
    let value = node.head.text;
    for (const span of node.templateSpans) {
      value += "{}";
      value += span.literal.text;
    }
    return { path: value, dynamic: node.templateSpans.length > 0 };
  }
  return null;
}

function findProperty(
  object: ts.ObjectLiteralExpression,
  name: string,
): ts.PropertyAssignment | null {
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }
    const key = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
      ? property.name.text
      : null;
    if (key === name) {
      return property;
    }
  }
  return null;
}

function readMethodFromOptions(node: ts.Expression | undefined): HttpMethod | null {
  if (!node || !ts.isObjectLiteralExpression(node)) {
    return null;
  }
  const property = findProperty(node, "method");
  if (!property) {
    return null;
  }
  const value = property.initializer;
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) {
    const method = value.text.toLowerCase();
    return isHttpMethod(method) ? method : null;
  }
  return null;
}

/** Heuristic: does the receiver look like an HTTP client (api, axios, httpClient…)? */
function isLikelyApiReceiver(receiver: string): boolean {
  const last = receiver.split(".").pop() ?? receiver;
  const normalized = last.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (normalized.length === 0) {
    return false;
  }
  return (
    normalized.endsWith("api") ||
    normalized.endsWith("client") ||
    normalized.endsWith("http") ||
    normalized.startsWith("axios") ||
    normalized.startsWith("request") ||
    normalized === "ky" ||
    normalized === "superagent" ||
    normalized === "fetcher"
  );
}

type DetectedCall = {
  method: HttpMethod;
  calleeText: string;
  path: ExtractedPath;
};

function detectCall(expression: ts.CallExpression): DetectedCall | null {
  const callee = expression.expression;
  const args = expression.arguments;

  if (ts.isIdentifier(callee) && callee.text.toLowerCase() === "fetch") {
    const extracted = readPathArgument(args[0]);
    if (!extracted) {
      return null;
    }
    return {
      method: readMethodFromOptions(args[1]) ?? "get",
      calleeText: "fetch",
      path: extracted,
    };
  }

  if (ts.isIdentifier(callee) && callee.text.toLowerCase() === "axios") {
    const config = args[0];
    if (!config || !ts.isObjectLiteralExpression(config)) {
      return null;
    }
    const url = findProperty(config, "url");
    if (!url) {
      return null;
    }
    const extracted = readPathArgument(url.initializer);
    if (!extracted) {
      return null;
    }
    return {
      method: readMethodFromOptions(config) ?? "get",
      calleeText: "axios",
      path: extracted,
    };
  }

  if (ts.isPropertyAccessExpression(callee)) {
    const method = callee.name.text.toLowerCase();
    if (!isHttpMethod(method)) {
      return null;
    }
    if (!isLikelyApiReceiver(callee.expression.getText())) {
      return null;
    }
    const extracted = readPathArgument(args[0]);
    if (!extracted) {
      return null;
    }
    return { method, calleeText: callee.getText(), path: extracted };
  }

  if (ts.isIdentifier(callee)) {
    const name = callee.text;
    const normalized = name.replace(/[^a-z0-9]/gi, "").toLowerCase();
    const looksLikeRequestHelper =
      normalized === "request" ||
      normalized === "apirequest" ||
      normalized === "requestjson" ||
      normalized === "fetchjson" ||
      normalized === "apifetch" ||
      normalized === "httprequest";
    if (!looksLikeRequestHelper) {
      return null;
    }
    const extracted = readPathArgument(args[0]);
    if (!extracted) {
      return null;
    }
    return {
      method: readMethodFromOptions(args[1]) ?? "get",
      calleeText: name,
      path: extracted,
    };
  }

  return null;
}

function snippetAt(sourceFile: ts.SourceFile, position: number, maxChars: number): string {
  const line = sourceFile.getLineAndCharacterOfPosition(position).line;
  const lineStarts = sourceFile.getLineStarts();
  const start = lineStarts[line] ?? 0;
  const end = lineStarts[line + 1] ?? sourceFile.text.length;
  const text = sourceFile.text.slice(start, end).trim();
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}

function visit(node: ts.Node, callback: (node: ts.Node) => void): void {
  callback(node);
  node.forEachChild((child) => {
    visit(child, callback);
  });
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

/**
 * Scans supported TypeScript/JavaScript files for HTTP calls and matches them
 * against changed OpenAPI operations.
 *
 * This is intentionally conservative: only calls with a statically resolvable
 * method and path produce matches, and every match carries file/line evidence.
 */
export function analyzeSource(
  files: readonly SourceFileInput[],
  operations: readonly ChangedOperation[],
  options: SourceAnalysisOptions = {},
): SourceAnalysisResult {
  const maxFiles = options.maxFiles ?? SOURCE_ANALYSIS_LIMITS.maxFiles;
  const maxFileBytes = options.maxFileBytes ?? SOURCE_ANALYSIS_LIMITS.maxFileBytes;
  const maxTotalBytes = options.maxTotalBytes ?? SOURCE_ANALYSIS_LIMITS.maxTotalBytes;
  const maxMatches = options.maxMatches ?? SOURCE_ANALYSIS_LIMITS.maxMatches;
  const maxDurationMs = options.maxDurationMs ?? SOURCE_ANALYSIS_LIMITS.maxDurationMs;
  const startedAt = Date.now();

  function assertWithinDeadline(): void {
    if (Date.now() - startedAt > maxDurationMs) {
      throw new SourceAnalysisError(
        "analysis_timeout",
        `Source analysis exceeded the ${maxDurationMs} ms time limit.`,
      );
    }
  }

  if (files.length > maxFiles) {
    throw new SourceAnalysisError(
      "too_many_files",
      `Source analysis accepts at most ${maxFiles} files per run.`,
    );
  }

  const dedupedOperations = new Map<string, ChangedOperation>();
  for (const operation of operations) {
    const method = operation.method.toLowerCase();
    if (!isHttpMethod(method)) {
      continue;
    }
    const key = `${method} ${operation.path}`;
    if (!dedupedOperations.has(key)) {
      dedupedOperations.set(key, { ...operation, method });
    }
  }
  const changedOperations = [...dedupedOperations.values()];

  const matches: SourceMatch[] = [];
  const limitations: string[] = [STATIC_ANALYSIS_LIMITATION];
  let filesScanned = 0;
  let filesSkipped = 0;
  let totalBytes = 0;
  let truncated = false;
  let usedDynamicPath = false;

  for (const file of files) {
    assertWithinDeadline();
    if (!isSupportedSourcePath(file.path) || isIgnoredSourcePath(file.path)) {
      filesSkipped += 1;
      continue;
    }

    const bytes = byteLength(file.content);
    if (bytes > maxFileBytes) {
      filesSkipped += 1;
      continue;
    }
    totalBytes += bytes;
    if (totalBytes > maxTotalBytes) {
      throw new SourceAnalysisError(
        "source_too_large",
        `Source analysis accepts at most ${maxTotalBytes} bytes per run.`,
      );
    }

    filesScanned += 1;
    const sourceFile = ts.createSourceFile(
      file.path,
      file.content,
      ts.ScriptTarget.Latest,
      true,
      scriptKindFor(file.path),
    );

    let visitedNodes = 0;
    visit(sourceFile, (node) => {
      visitedNodes += 1;
      if ((visitedNodes & 1023) === 0) {
        assertWithinDeadline();
      }
      if (truncated || !ts.isCallExpression(node)) {
        return;
      }
      const detected = detectCall(node);
      if (!detected) {
        return;
      }
      const normalizedPath = normalizeCallPath(detected.path.path);
      if (!normalizedPath) {
        return;
      }
      const operationMatch = matchOperation(detected.method, normalizedPath, changedOperations);
      if (!operationMatch) {
        return;
      }

      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      const line = position.line + 1;
      const column = position.character + 1;
      if (detected.path.dynamic) {
        usedDynamicPath = true;
      }
      matches.push({
        filePath: file.path,
        line,
        column,
        snippet: snippetAt(sourceFile, node.getStart(sourceFile), SOURCE_ANALYSIS_LIMITS.maxSnippetChars),
        call: detected.calleeText,
        method: detected.method,
        path: normalizedPath,
        matchedMethod: operationMatch.operation.method,
        matchedPath: operationMatch.operation.path,
        operationId: operationMatch.operation.operationId ?? null,
        confidence: detected.path.dynamic ? "medium" : operationMatch.confidence,
        evidence: `${detected.calleeText} call at ${file.path}:${line}:${column} matched ${
          operationMatch.operation.method.toUpperCase()
        } ${operationMatch.operation.path}`,
      });

      if (matches.length >= maxMatches) {
        truncated = true;
      }
    });
  }

  if (changedOperations.length === 0) {
    limitations.push("No changed operations were available to match against.");
  }
  if (filesSkipped > 0) {
    limitations.push(
      `${filesSkipped} file(s) were skipped because they were unsupported, ignored, or over the per-file size limit.`,
    );
  }
  if (truncated) {
    limitations.push(`Matches were truncated at the configured limit of ${maxMatches}.`);
  }
  if (usedDynamicPath) {
    limitations.push(
      "Template-literal paths with interpolations are matched by treating each interpolation as a path parameter.",
    );
  }

  return {
    filesScanned,
    filesSkipped,
    totalBytes,
    matches,
    limitations,
  };
}
