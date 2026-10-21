"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiRequestError, describeErrorDetails } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { cn } from "@/lib/cn";

type Mode = "signin" | "signup";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 12;

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
      router.replace("/dashboard");
    }
  }, [status, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError("Enter a valid email address.");
      setDetails([]);
      return;
    }

    if (mode === "signup" && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
      setDetails([]);
      return;
    }

    setSubmitting(true);
    setError(null);
    setDetails([]);

    try {
      if (mode === "signup") {
        await signUp(trimmedEmail, password);
      } else {
        await signIn(trimmedEmail, password);
      }
      router.replace("/dashboard");
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
      <div className="card p-6">
        <p className="text-sm leading-6 text-muted">
          Signed in as <span className="font-medium text-foreground">{user.email}</span>.
        </p>
        <Link href="/dashboard" className="btn-primary mt-4 inline-flex">
          Open workspace
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-5 sm:p-7">
      <h2 className="text-xl font-semibold tracking-tight">
        {mode === "signin" ? "Sign in to ContractRipple" : "Create your account"}
      </h2>
      <p className="mt-1.5 text-sm leading-6 text-muted">
        Your projects, contract versions, comparison history, and reports are private to your
        account.
      </p>

      <div
        className="mt-5 grid grid-cols-2 gap-1 rounded-lg bg-surface-strong p-1"
        role="group"
        aria-label="Authentication mode"
      >
        {(
          [
            { value: "signin", label: "Sign in" },
            { value: "signup", label: "Create account" },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              setMode(option.value);
              setError(null);
              setDetails([]);
            }}
            aria-pressed={mode === option.value}
            className={cn(
              "min-h-9 whitespace-nowrap rounded-md px-2 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
              mode === option.value
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
        <Field id="auth-email" label="Email" required>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            className="input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            aria-invalid={error != null && !EMAIL_PATTERN.test(email.trim()) ? true : undefined}
          />
        </Field>

        <Field
          id="auth-password"
          label="Password"
          required
          hint={mode === "signup" ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
        >
          <div className="relative">
            <input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : 1}
              maxLength={200}
              className="input pr-20"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby={mode === "signup" ? "auth-password-hint" : undefined}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-1.5 my-auto min-h-8 rounded px-2 text-xs font-medium text-muted transition-colors hover:text-foreground"
              onClick={() => setShowPassword((current) => !current)}
              aria-pressed={showPassword}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </Field>

        {error ? (
          <Alert tone="danger" title={error} live>
            {details.length > 0 ? (
              <ul className="list-inside list-disc text-xs">
                {details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </Alert>
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

      <p className="mt-5 text-xs leading-5 text-subtle">
        Sessions use an HttpOnly, SameSite cookie. Unsafe requests also require a session-bound CSRF
        token. There is no email verification or password reset in this release.
      </p>
    </div>
  );
}
