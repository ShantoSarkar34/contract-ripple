import type { Metadata } from "next";
import LoginForm from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in — ContractRipple",
  description:
    "Sign in to manage private projects, OpenAPI contract versions, comparison history, and analysis reports.",
};

const GUARANTEES = [
  "Opaque, database-backed sessions with a seven-day lifetime.",
  "Password hashes use scrypt with a unique salt; raw passwords are never stored.",
  "Login, registration, comparison, and source-analysis requests are rate limited.",
];

export default function LoginPage() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 md:px-6 lg:grid-cols-[1fr_26rem] lg:items-center lg:gap-14">
      <section className="order-2 lg:order-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Account access
        </p>
        <h1 className="mt-2 max-w-lg text-2xl font-semibold tracking-tight sm:text-3xl">
          Your contract analysis workspace, scoped to your account.
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-muted">
          Projects and every nested resource are checked against your session on the server.
          Another account cannot read, modify, download, or attach analysis to your data, even with
          a known id.
        </p>

        <ul className="mt-6 space-y-3">
          {GUARANTEES.map((item) => (
            <li key={item} className="flex gap-3 text-sm leading-6 text-muted">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-light text-success"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <div className="order-1 w-full lg:order-2">
        <LoginForm />
      </div>
    </div>
  );
}
