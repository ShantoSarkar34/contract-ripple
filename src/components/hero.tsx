import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative px-4 py-16 md:px-8 md:py-24 overflow-hidden">
      <div className="max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-light text-primary text-xs font-semibold mb-6 border border-primary/20">
          <span className="relative -top-[1px] flex h-1.5 w-1.5 rounded-full bg-primary"></span>
          Developer Preview &bull; SaaS for API contract change review
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground mb-6 text-balance">
          Review API contract changes.<br />
          Understand the ripple impact.
        </h1>
        <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          ContractRipple gives frontend teams a centralized workspace to manage API contract
          versions, review differences, explore impact reports, and organize analysis history —
          so you can make better-informed decisions before integrating an updated API contract.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/contracts" className="btn-primary">
            Create your first workspace
          </Link>
          <Link href="/impact" className="btn-secondary">
            View demo impact report
          </Link>
        </div>
      </div>

      {/* Decorative gradients */}
      <div className="absolute inset-0 -z-10 opacity-20">
        <div className="absolute top-1/4 left-1/6 w-64 h-64 rounded-full bg-primary blur-[120px]"></div>
        <div className="absolute bottom-1/4 right-1/6 w-72 h-72 rounded-full bg-primary blur-[120px]"></div>
      </div>
    </section>
  );
}
