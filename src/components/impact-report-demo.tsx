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

const TYPE_LABEL = {
  added: { label: "Added", color: "bg-success/10 text-success border-success/20", dot: "bg-success" },
  removed: { label: "Removed", color: "bg-danger/10 text-danger border-danger/20", dot: "bg-danger" },
  changed: { label: "Changed", color: "bg-warning/10 text-warning border-warning/20", dot: "bg-warning" },
} as const;

export default function ImpactReportDemo() {
  return (
    <section className="px-4 py-16 md:px-8 md:py-24">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Demo impact report</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Sample diff between contract versions <span className="font-mono text-brand">v2.1.0 → v2.2.0</span>
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300">
            5 changes detected
          </span>
        </div>

        <div className="rounded-xl border border-slate-200/60 bg-white dark:border-slate-700/50 dark:bg-slate-900 shadow-sm overflow-hidden">
          <table className="w-full text-left border-b border-slate-200/50 dark:border-slate-800/50">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Method</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Endpoint</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800/50">
              {CHANGES.map((change, i) => {
                const style = TYPE_LABEL[change.type];
                return (
                  <tr key={i} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold border ${style.color}`}>
                        <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${style.dot}`} />
                        {style.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-brand">{change.method}</td>
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

        <div className="mt-8 rounded-xl border border-slate-200/60 bg-brand-50 dark:border-slate-700/50 dark:bg-brand-50/10 p-6">
          <h3 className="font-semibold text-brand-600 dark:text-brand-400 mb-2">Recommended next steps</h3>
          <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-2 list-disc pl-5">
            <li>Update the <span className="font-mono">InvoiceForm</span> component to handle the new <span className="font-mono">POST /v1/invoices</span> endpoint.</li>
            <li>Add validation for the now-required <span className="font-mono">email</span> field in <span className="font-mono">GET /v1/users/{'{'}id{'}'}</span> responses.</li>
            <li>Remove any calls to the deleted <span className="font-mono">DELETE /v1/legacy/items/{'{'}id{'}'}</span> endpoint.</li>
            <li>Create a test suite for the new <span className="font-mono">GET /v1/reports/export</span> CSV endpoint.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
