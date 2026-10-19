type Activity = {
  contract: string;
  version: string;
  author: string;
  time: string;
  status: "reviewed" | "pending" | "approved";
};

const ACTIVITIES: Activity[] = [
  { contract: "payments-api", version: "v3.4.1", author: "alice.dev", time: "2h ago", status: "reviewed" },
  { contract: "users-api", version: "v2.2.0", author: "bob.smith", time: "5h ago", status: "pending" },
  { contract: "inventory-api", version: "v1.9.0", author: "carol.lee", time: "1d ago", status: "approved" },
  { contract: "notifications-api", version: "v4.0.2", author: "dave.kim", time: "2d ago", status: "reviewed" },
];

const STATUS_STYLE = {
  reviewed: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  pending: "bg-warning/10 text-warning dark:bg-warning/20",
  approved: "bg-success/10 text-success dark:bg-success/20",
} as const;

export default function RecentActivity() {
  return (
    <section className="px-4 py-12 md:px-8 md:py-16">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-xl font-bold text-foreground mb-6">Recent contract reviews</h2>
        <div className="rounded-xl border border-slate-200/60 bg-white dark:border-slate-700/50 dark:bg-slate-900 shadow-sm overflow-hidden">
          <table className="w-full text-left divide-y divide-slate-200/50 dark:divide-slate-800/50">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contract</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Version</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Author</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Time</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {ACTIVITIES.map((a, i) => {
                const style = STATUS_STYLE[a.status];
                return (
                  <tr key={i} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-slate-700 dark:text-slate-300">{a.contract}</td>
                    <td className="px-6 py-4 font-mono text-sm text-slate-700 dark:text-slate-300">{a.version}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{a.author}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{a.time}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-500">
          Demo data — connect your backend to see real contract reviews.
        </p>
      </div>
    </section>
  );
}
