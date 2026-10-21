import Link from "next/link";

export default function Hero() {
  return (
    <section className="px-4 py-16 md:px-6 md:py-24">
      <div className="mx-auto max-w-4xl text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
          Developer preview · API contract change review
        </p>

        <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl">
          Review API contract changes.
          <br className="hidden sm:block" /> Understand the ripple impact.
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
          ContractRipple gives frontend teams one workspace to store contract versions, review every
          classified difference, trace affected source files, and export the result — so you can
          decide before an update ships.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/login" className="btn-primary w-full sm:w-auto">
            Start reviewing contracts
          </Link>
          <a href="#impact-demo" className="btn-secondary w-full sm:w-auto">
            See a demo report
          </a>
        </div>

        <p className="mt-4 text-xs text-subtle">
          Projects, analyses, and reports stay private to your account.
        </p>
      </div>
    </section>
  );
}
