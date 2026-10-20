type Feature = {
  icon: string;
  title: string;
  description: string;
};

const FEATURES: Feature[] = [
  {
    icon: "📦",
    title: "Contract version management",
    description: "Store and organize API contract versions in one place, with a clear history of every published change.",
  },
  {
    icon: "🔍",
    title: "Diff review",
    description: "See exactly what changed between contract versions — added, removed, or modified endpoints, fields, and types.",
  },
  {
    icon: "📊",
    title: "Impact reports",
    description: "Discover which frontend modules and endpoints are affected by a contract change, so you know where to validate.",
  },
  {
    icon: "🗂️",
    title: "Analysis history",
    description: "Keep a searchable log of past contract reviews and decisions, so nothing gets lost as the team grows.",
  },
];

export default function Features() {
  return (
    <section className="px-4 py-16 md:px-8 md:py-24 bg-slate-50 dark:bg-slate-950/30 border-y border-slate-200/50 dark:border-slate-800/50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3 tracking-tight">
            Built for a practical, explainable workflow
          </h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            From contract upload to validation planning, ContractRipple surfaces findings in a clear,
            navigable format so developers can review changes with confidence.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="card p-6 hover:shadow-md transition-shadow"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-primary mb-4 shrink-0"
                aria-hidden="true"
              >
                {feature.icon}
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
