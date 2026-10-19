import Link from "next/link";

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

const STATUS_CONFIG = {
  reviewed: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", dot: "bg-slate-500 dark:bg-slate-400" },
  pending: { bg: "bg-warning-light dark:bg-warning/20", text: "text-warning dark:text-warning", dot: "bg-warning dark:bg-warning" },
  approved: { bg: "bg-success-light dark:bg-success/20", text: "text-success dark:text-success", dot: "bg-success dark:bg-success" },
} as const;

export default function RecentActivity() {
  return (
    <section className="px-4 py-12 md:px-8 md:py-16">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">Recent contract reviews</h2>
          <Link href="/history" className="btn-ghost">
            View all →
          </Link>
        </div>
        <div className="card overflow-hidden">
          <table className="w-full text-left divide-y divide-slate-200/50 dark:divide-slate-800/50">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50">
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contract</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Version</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Author</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Time</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {ACTIVITIES.map((a, i) => {
                const style = STATUS_CONFIG[a.status];
                return (
                  <tr key={i} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-slate-700 dark:text-slate-300">{a.contract}</td>
                    <td className="px-6 py-4 font-mono text-sm text-slate-700 dark:text-slate-300">{a.version}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{a.author}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{a.time}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
                        <span className="mr-1.5 h-1.5 w-1.5 rounded-full ${style.dot}"></span>
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
