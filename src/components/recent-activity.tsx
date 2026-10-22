import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/badge";

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

const STATUS_TONE: Record<Activity["status"], BadgeTone> = {
  reviewed: "neutral",
  pending: "warning",
  approved: "success",
};

export default function RecentActivity() {
  return (
    <section className="px-4 py-16 md:px-6 md:py-20">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Recent contract reviews
              </h2>
              <Badge tone="outline">Demo data</Badge>
            </div>
            <p className="mt-1 text-sm text-muted">
              Example activity from a sample team workspace.
            </p>
          </div>
          <Link href="/dashboard" className="btn-ghost">
            Open workspace
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="card overflow-hidden">
          <div
            role="region"
            aria-label="Demo recent activity table, horizontally scrollable"
            tabIndex={0}
            className="overflow-x-auto"
          >
            <table className="w-full min-w-[34rem] border-collapse text-left">
              <caption className="sr-only">
                Demo contract review activity. Sample data, not a real analysis.
              </caption>
              <thead>
                <tr className="border-b border-line bg-surface-muted">
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-subtle">
                    Contract
                  </th>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-subtle">
                    Version
                  </th>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-subtle">
                    Author
                  </th>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-subtle">
                    Time
                  </th>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-subtle">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ACTIVITIES.map((activity) => (
                  <tr key={`${activity.contract}-${activity.version}`} className="transition-colors hover:bg-surface-muted">
                    <th scope="row" className="px-5 py-3.5 font-mono text-sm font-medium text-foreground">
                      {activity.contract}
                    </th>
                    <td className="px-5 py-3.5 font-mono text-sm text-muted">{activity.version}</td>
                    <td className="px-5 py-3.5 text-sm text-muted">{activity.author}</td>
                    <td className="px-5 py-3.5 text-sm text-muted">{activity.time}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={STATUS_TONE[activity.status]} withDot>
                        {activity.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-3 text-xs text-subtle">
          Demo data — sign in to see analyses from your own projects.
        </p>
      </div>
    </section>
  );
}
