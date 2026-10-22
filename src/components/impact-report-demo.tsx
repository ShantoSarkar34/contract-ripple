type Change = {
  type: "added" | "removed" | "changed";
  method: string;
  path: string;
  detail: string;
};

const CHANGES: Change[] = [
  { type: "added", method: "POST", path: "/v1/invoices", detail: "New endpoint to create invoices" },
  { type: "changed", method: "GET", path: "/v1/users/{id}", detail: "Response field `email` is now required" },
  { type: "removed", method: "DELETE", path: "/v1/legacy/items/{id}", detail: "Legacy item deletion endpoint removed" },
  { type: "added", method: "GET", path: "/v1/reports/export", detail: "New CSV export endpoint added" },
  { type: "changed", method: "PUT", path: "/v1/users/{id}", detail: "Request body field `phone` changed from string to object" },
];

const TYPE_CONFIG = {
  added: { label: "Added", badge: "bg-success-light text-success border-success/20", dot: "bg-success" },
  removed: { label: "Removed", badge: "bg-danger-light text-danger border-danger/20", dot: "bg-danger" },
  changed: { label: "Changed", badge: "bg-warning-light text-warning border-warning/20", dot: "bg-warning" },
} as const;

export default function ImpactReportDemo() {
  return (
    <section id="impact-demo" className="scroll-mt-20 px-4 py-16 md:px-6 md:py-20">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Demo impact report
              </h2>
              <span className="badge border border-line-strong bg-surface text-subtle">
                Sample data
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">
              Sample diff between contract versions{" "}
              <span className="font-mono text-primary">v2.1.0 → v2.2.0</span>
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-line-strong bg-surface px-3 py-1 text-xs font-medium text-muted shadow-sm">
            5 changes detected
          </span>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-b border-line text-left">
              <caption className="sr-only">
                Demo impact report: sample contract changes between two example versions.
              </caption>
              <thead>
                <tr className="bg-surface-muted">
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-subtle">Type</th>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-subtle">Method</th>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-subtle">Endpoint</th>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-subtle">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {CHANGES.map((change, i) => {
                  const style = TYPE_CONFIG[change.type];
                  return (
                    <tr key={i} className="transition-colors hover:bg-surface-muted">
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-bold ${style.badge}`}>
                          <span className={`mr-2 h-1.5 w-1.5 rounded-full ${style.dot}`} />
                          {style.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-sm text-primary">{change.method}</td>
                      <td className="px-5 py-4 font-mono text-sm text-muted">
                        {change.path}
                      </td>
                      <td className="px-5 py-4 text-sm text-muted">{change.detail}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 card p-6">
          <h3 className="font-semibold text-primary dark:text-primary mb-2 flex items-center gap-2">
            <span className="h-4 w-4 rounded-full bg-primary"></span>
            Recommended next steps
          </h3>
          <ul className="text-sm text-muted space-y-2 list-disc pl-5">
            <li>
              Update the <span className="font-mono text-primary">InvoiceForm</span> component to handle the new{" "}
              <span className="font-mono text-primary">POST /v1/invoices</span> endpoint.
            </li>
            <li>
              Add validation for the now-required{" "}
              <span className="font-mono text-primary">email</span> field in{" "}
              <span className="font-mono text-primary">GET /v1/users/{'{'}id{'}'}</span> responses.
            </li>
            <li>
              Remove any calls to the deleted{" "}
              <span className="font-mono text-primary">DELETE /v1/legacy/items/{'{'}id{'}'}</span> endpoint.
            </li>
            <li>
              Create a test suite for the new{" "}
              <span className="font-mono text-primary">GET /v1/reports/export</span> CSV endpoint.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
