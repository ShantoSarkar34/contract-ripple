import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative px-4 py-16 md:px-8 md:py-24 overflow-hidden">
      <div className="max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-xs font-semibold mb-6 border border-brand-100">
          <span className="relative -top-px flex h-1.5 w-1.5 rounded-full bg-brand"></span>
          Developer Preview &bull; SaaS for API contract change review
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground mb-6">
          Review API contract changes.<br />
          Understand the ripple impact.
        </h1>
        <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          ContractRipple gives frontend teams a centralized workspace to manage
          API contract versions, review differences, explore impact reports, and
          organize analysis history—so you can make better-informed decisions
          before integrating an updated API contract.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/contracts"
            className="px-6 py-3 text-sm font-semibold text-white bg-brand rounded-lg hover:bg-brand-600 transition-colors shadow-md"
          >
            Create your first workspace
          </Link>
          <Link
            href="/impact"
            className="px-6 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            View demo impact report
          </Link>
        </div>
      </div>

      {/* Decorative grid dots */}
      <div className="absolute inset-0 -z-10 opacity-20">
        <div className="absolute top-1/3 left-1/4 w-24 h-24 rounded-full bg-brand blur-[100px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-32 h-32 rounded-full bg-brand blur-[100px]"></div>
      </div>
    </section>
  );
}
