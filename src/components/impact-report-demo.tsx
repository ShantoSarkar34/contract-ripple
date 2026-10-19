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
    <section className="px-4 py-16 md:px-8 md:py-24">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Demo impact report</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
              Sample diff between contract versions{" "}
              <span className="font-mono text-primary">v2.1.0 → v2.2.0</span>
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 shadow-sm">
            5 changes detected
          </span>
        </div>

        <div className="card overflow-hidden">
          <table className="w-full text-left border-b border-slate-200/50 dark:border-slate-800/50">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Method</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Endpoint</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800/50">
              {CHANGES.map((change, i) => {
                const style = TYPE_CONFIG[change.type];
                return (
                  <tr key={i} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold border ${style.badge}`}>
                        <span className={`mr-2 h-1.5 w-1.5 rounded-full ${style.dot}`} />
                        {style.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-primary">{change.method}</td>
                    <td className="px-6 py-4 font-mono text-sm text-slate-700 dark:text-slate-300">
                      {change.path}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{change.detail}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-8 card p-6">
          <h3 className="font-semibold text-primary dark:text-primary mb-2 flex items-center gap-2">
            <span className="h-4 w-4 rounded-full bg-primary"></span>
            Recommended next steps
          </h3>
          <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-2 list-disc pl-5">
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
