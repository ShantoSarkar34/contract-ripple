import Link from "next/link";
import Features from "@/components/features";
import Hero from "@/components/hero";
import ImpactReportDemo from "@/components/impact-report-demo";
import RecentActivity from "@/components/recent-activity";

export default function Home() {
  return (
    <>
      <Hero />
      <Features />
      <ImpactReportDemo />
      <RecentActivity />

      <section className="px-4 pb-20 md:px-6">
        <div className="mx-auto max-w-5xl rounded-2xl border border-line bg-surface-muted px-6 py-10 text-center sm:px-10">
          <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Ready to review your next contract change?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
            Create an account, upload a baseline and candidate OpenAPI document, and review the
            persisted analysis with its evidence.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login" className="btn-primary w-full sm:w-auto">
              Create your workspace
            </Link>
            <Link href="/contracts" className="btn-secondary w-full sm:w-auto">
              Open workspace
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
