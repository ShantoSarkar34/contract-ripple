import type { Metadata } from "next";
import LoginForm from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in — ContractRipple",
  description:
    "Sign in to manage private projects, OpenAPI contract versions, comparison history, and analysis reports.",
};

export default function LoginPage() {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-12 md:px-8 lg:grid-cols-[1fr_28rem] lg:items-center">
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Account access
        </p>
        <h1 className="mt-3 max-w-lg text-3xl font-semibold tracking-tight sm:text-4xl">
          Your contract analysis workspace, scoped to your account.
        </h1>
        <p className="mt-4 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-300">
          Projects and every nested resource are checked against your session on the server.
          Another account cannot read, modify, download, or attach analysis to your data, even
          with a known id.
        </p>
        <ul className="mt-6 space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
            Opaque, database-backed sessions with a seven-day lifetime.
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
            Password hashes use scrypt with a unique salt; raw passwords are never stored.
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
            Login, registration, comparison, and source-analysis requests are rate limited.
          </li>
        </ul>
      </section>

      <LoginForm />
    </div>
  );
}
