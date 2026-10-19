import type { AnalysisRunDetailDto, FindingDto } from "@contract-ripple/shared";
import {
  CATEGORY_LABELS,
  CHANGE_TYPE_CLASSES,
  CHANGE_TYPE_LABELS,
  RISK_BADGE_CLASSES,
  RISK_LABELS,
  methodClass,
} from "@/lib/findings";

type SummaryCardProps = {
  label: string;
  value: number;
  className: string;
};

function SummaryCard({ label, value, className }: SummaryCardProps) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${className}`}>{value}</p>
    </div>
  );
}

function FindingRow({ finding }: { finding: FindingDto }) {
  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {finding.method ? (
            <span
              className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold uppercase ${methodClass(
                finding.method,
              )}`}
            >
              {finding.method}
            </span>
          ) : null}
          <span className="font-mono text-sm font-semibold text-foreground">
            {finding.path ?? "—"}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {CATEGORY_LABELS[finding.category]} ·{" "}
            <span className={CHANGE_TYPE_CLASSES[finding.changeType]}>
              {CHANGE_TYPE_LABELS[finding.changeType]}
            </span>
          </span>
        </div>
        <span className={`badge ${RISK_BADGE_CLASSES[finding.risk]}`}>
          {RISK_LABELS[finding.risk]}
        </span>
      </div>

      <p className="mt-3 text-sm font-medium text-foreground">{finding.summary}</p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{finding.explanation}</p>

      <p className="mt-3 break-all font-mono text-xs text-slate-500 dark:text-slate-500">
        {finding.location}
      </p>

      {finding.before !== undefined || finding.after !== undefined ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {finding.before !== undefined && finding.before !== null ? (
            <div className="rounded-md border border-danger/20 bg-danger-light/60 p-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-danger">Before</p>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-slate-700 dark:text-slate-200">
                {finding.before}
              </pre>
            </div>
          ) : null}
          {finding.after !== undefined && finding.after !== null ? (
            <div className="rounded-md border border-success/20 bg-success-light/60 p-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-success">
                After
              </p>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-slate-700 dark:text-slate-200">
                {finding.after}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export default function ComparisonResults({ analysis }: { analysis: AnalysisRunDetailDto }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold text-foreground">
          Comparison report
          {analysis.label ? (
            <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
              {analysis.label}
            </span>
          ) : null}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {new Date(analysis.createdAt).toLocaleString()} · {analysis.durationMs} ms
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Total changes" value={analysis.totalFindings} className="text-foreground" />
        <SummaryCard
          label="Non-breaking"
          value={analysis.nonBreakingCount}
          className="text-success"
        />
        <SummaryCard
          label="Potentially breaking"
          value={analysis.potentiallyBreakingCount}
          className="text-danger"
        />
        <SummaryCard label="Unknown" value={analysis.unknownCount} className="text-warning" />
      </dl>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="card p-3 text-sm">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Baseline
          </dt>
          <dd className="mt-1 text-foreground">
            {analysis.baseline.contractName}
            <span className="text-slate-500 dark:text-slate-400">
              {" "}
              · {analysis.baseline.versionLabel ?? analysis.baseline.versionId} · OpenAPI{" "}
              {analysis.baseline.openapi}
            </span>
          </dd>
        </div>
        <div className="card p-3 text-sm">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Candidate
          </dt>
          <dd className="mt-1 text-foreground">
            {analysis.candidate.contractName}
            <span className="text-slate-500 dark:text-slate-400">
              {" "}
              · {analysis.candidate.versionLabel ?? analysis.candidate.versionId} · OpenAPI{" "}
              {analysis.candidate.openapi}
            </span>
          </dd>
        </div>
      </dl>

      {analysis.truncated ? (
        <p className="rounded-md border border-warning/30 bg-warning-light p-3 text-sm text-warning">
          The engine stopped after the configured finding limit. Results below are truncated.
        </p>
      ) : null}

      {analysis.limitations.length > 0 ? (
        <details className="card p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-foreground">
            Analysis limitations ({analysis.limitations.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600 dark:text-slate-400">
            {analysis.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {analysis.findings.length === 0 ? (
        <p className="card p-6 text-center text-sm text-slate-500 dark:text-slate-400">
          No differences were detected between the selected versions.
        </p>
      ) : (
        <ul className="space-y-3">
          {analysis.findings.map((finding) => (
            <FindingRow key={finding.id} finding={finding} />
          ))}
        </ul>
      )}
    </section>
  );
}
