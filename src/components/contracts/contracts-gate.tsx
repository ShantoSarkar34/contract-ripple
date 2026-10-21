"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import ContractsWorkspace from "./contracts-workspace";

/**
 * Keeps the data workspace unmounted until the session is known, so its effects
 * never fire unauthenticated requests and its hook order stays stable.
 */
export default function ContractsGate() {
  const { status, user, error, refresh } = useAuth();

  if (status === "checking") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
        <div className="card p-6" role="status" aria-live="polite">
          <p className="text-sm text-muted">Checking your session…</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
        <div className="card p-6">
          <h1 className="text-lg font-semibold">Could not verify your session</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            {error ?? "The API did not respond as expected."}
          </p>
          <button type="button" className="btn-primary mt-4" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (status !== "authenticated" || !user) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
        <div className="card max-w-xl p-6">
          <h1 className="text-xl font-semibold tracking-tight">Sign in to use the workspace</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Projects, contract versions, comparisons, source analysis, and report downloads are
            private to the account that created them.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/login" className="btn-primary">
              Sign in or create an account
            </Link>
            <Link href="/" className="btn-secondary">
              Back to overview
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <ContractsWorkspace />;
}
