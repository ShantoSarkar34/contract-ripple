"use client";

import { useState } from "react";
import type { AnalysisRunDetailDto, ReportFormat } from "@contract-ripple/shared";
import { ApiRequestError, api, describeErrorDetails } from "@/lib/api";

type ReportError = { message: string; details: string[] };

function toReportError(error: unknown): ReportError {
  if (error instanceof ApiRequestError) {
    return { message: error.message, details: describeErrorDetails(error) };
  }
  return {
    message: error instanceof Error ? error.message : "The report could not be downloaded.",
    details: [],
  };
}

function saveArchive(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function ReportActions({ analysis }: { analysis: AnalysisRunDetailDto }) {
  const [pending, setPending] = useState<ReportFormat | null>(null);
  const [error, setError] = useState<ReportError | null>(null);
  const [status, setStatus] = useState("");

  async function handleExport(format: ReportFormat): Promise<void> {
    setPending(format);
    setError(null);
    setStatus("Preparing report…");
    try {
      const blob = await api.getComparisonReportFile(analysis.id, format);
      saveArchive(blob, `contract-ripple-${analysis.id}.${format === "markdown" ? "md" : "json"}`);
      setStatus(`${format === "json" ? "JSON" : "Markdown"} report downloaded.`);
    } catch (downloadError) {
      setStatus("");
      setError(toReportError(downloadError));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-subtle">
          Export
        </span>
        <button
          type="button"
          className="btn-secondary px-3 py-1.5 text-xs"
          disabled={pending !== null}
          onClick={() => void handleExport("json")}
          aria-label="Download JSON report"
        >
          {pending === "json" ? "Preparing…" : "JSON"}
        </button>
        <button
          type="button"
          className="btn-secondary px-3 py-1.5 text-xs"
          disabled={pending !== null}
          onClick={() => void handleExport("markdown")}
          aria-label="Download Markdown report"
        >
          {pending === "markdown" ? "Preparing…" : "Markdown"}
        </button>
      </div>
      <p className="text-right text-[11px] text-subtle">
        Findings, suggestions, and the latest source analysis.
      </p>
      {status ? (
        <p className="text-xs text-success" role="status" aria-live="polite">
          {status}
        </p>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="max-w-xs rounded-md border border-danger/30 bg-danger-light p-2 text-left text-xs text-danger"
        >
          <p className="font-medium">{error.message}</p>
          {error.details.length > 0 ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {error.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
