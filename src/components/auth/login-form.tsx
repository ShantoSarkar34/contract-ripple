"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiRequestError, describeErrorDetails } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

type Mode = "signin" | "signup";

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

export default function LoginForm() {
  const router = useRouter();
  const { status, user, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[]>([]);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/contracts");
    }
  }, [status, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setDetails([]);

    try {
      if (mode === "signup") {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      router.replace("/contracts");
    } catch (submitError) {
      setError(errorMessage(submitError));
      if (submitError instanceof ApiRequestError) {
        setDetails(describeErrorDetails(submitError));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "authenticated" && user) {
    return (
      <div className="card p-6 text-sm">
        <p className="text-slate-600 dark:text-slate-300">
          Signed in as <span className="font-medium text-foreground">{user.email}</span>.
        </p>
        <Link href="/contracts" className="btn-primary mt-4 inline-flex">
          Open workspace
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        {mode === "signin" ? "Sign in to ContractRipple" : "Create your account"}
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Your projects, contract versions, comparison history, and reports are private to your
        account.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm dark:bg-slate-800">
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setError(null);
            setDetails([]);
          }}
          aria-pressed={mode === "signin"}
          className={`rounded-md px-3 py-2 font-medium transition-colors ${
            mode === "signin"
              ? "bg-white text-foreground shadow-sm dark:bg-slate-900"
              : "text-slate-600 hover:text-foreground dark:text-slate-300"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setError(null);
            setDetails([]);
          }}
          aria-pressed={mode === "signup"}
          className={`rounded-md px-3 py-2 font-medium transition-colors ${
            mode === "signup"
              ? "bg-white text-foreground shadow-sm dark:bg-slate-900"
              : "text-slate-600 hover:text-foreground dark:text-slate-300"
          }`}
        >
          Create account
        </button>
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="auth-email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            required
            className="input mt-1"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="auth-password" className="text-sm font-medium">
              Password
            </label>
            {mode === "signup" ? (
              <span className="text-xs text-slate-400 dark:text-slate-500">12+ characters</span>
            ) : null}
          </div>
          <div className="relative mt-1">
            <input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={mode === "signup" ? 12 : 1}
              maxLength={200}
              className="input pr-20"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-2 my-auto rounded px-2 text-xs font-medium text-slate-500 hover:text-foreground dark:text-slate-400"
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {error ? (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
          >
            <p>{error}</p>
            {details.length > 0 ? (
              <ul className="mt-1 list-inside list-disc text-xs">
                {details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting
            ? mode === "signup"
              ? "Creating account…"
              : "Signing in…"
            : mode === "signup"
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-xs leading-5 text-slate-500 dark:text-slate-400">
        Sessions use an HttpOnly, SameSite cookie. Unsafe requests also require a session-bound
        CSRF token. There is no email verification or password reset in this release.
      </p>
    </div>
  );
}
