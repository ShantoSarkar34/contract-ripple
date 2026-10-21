type Feature = {
  icon: React.ReactNode;
  title: string;
  description: string;
};

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const FEATURES: Feature[] = [
  {
    icon: (
      <Icon>
        <path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </Icon>
    ),
    title: "Contract version management",
    description:
      "Store and organize API contract versions in one place, with a clear history of every published change.",
  },
  {
    icon: (
      <Icon>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
        <path d="M8 11h6M11 8v6" />
      </Icon>
    ),
    title: "Diff review",
    description:
      "See exactly what changed between contract versions — added, removed, or modified endpoints, fields, and types.",
  },
  {
    icon: (
      <Icon>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </Icon>
    ),
    title: "Impact reports",
    description:
      "Trace changed operations into frontend files with source evidence, so you know which integrations to validate.",
  },
  {
    icon: (
      <Icon>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
        <path d="M12 7v5l3 2" />
      </Icon>
    ),
    title: "Analysis history",
    description:
      "Keep a paginated log of past contract reviews and decisions, so nothing gets lost as the team grows.",
  },
];

export default function Features() {
  return (
    <section className="border-y border-line bg-surface-muted px-4 py-16 md:px-6 md:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Built for a practical, explainable workflow
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted sm:text-base">
            From contract upload to validation planning, ContractRipple surfaces findings in a
            clear, navigable format so developers can review changes with confidence.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="card p-5">
              <div className="mb-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                {feature.icon}
              </div>
              <h3 className="font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
