"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { SkeletonText } from "@/components/ui/feedback";

/**
 * Keeps authenticated workspace content unmounted until the session is known,
 * so child effects never fire unauthenticated requests. Also renders the
 * checking, error, and signed-out states consistently.
 */
export function AuthGate({
  children,
  signInTitle,
  signInDescription,
}: {
  children: React.ReactNode;
  signInTitle: string;
  signInDescription: React.ReactNode;
}) {
  const { status, user, error, refresh } = useAuth();

  if (status === "checking") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
        <div className="card p-6" role="status" aria-live="polite">
          <p className="text-sm font-medium text-foreground">Checking your session…</p>
          <SkeletonText lines={2} className="mt-4" />
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
        <div className="card p-6">
          <h1 className="text-lg font-semibold">Could not verify your session</h1>
          <p className="mt-2 text-sm leading-6 text-muted" role="alert">
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
          <h1 className="text-xl font-semibold tracking-tight">{signInTitle}</h1>
          <div className="mt-2 text-sm leading-6 text-muted">{signInDescription}</div>
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

  return <>{children}</>;
}
