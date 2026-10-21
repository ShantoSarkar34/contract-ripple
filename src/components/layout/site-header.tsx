"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/cn";
import { Logo } from "./logo";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/#impact-demo", label: "Demo report" },
  { href: "/dashboard", label: "Workspace" },
];

function isActive(pathname: string, href: string): boolean {
  if (href.includes("#")) {
    return false;
  }
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { status, user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      setMenuOpen(false);
      router.push("/");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header
      className="sticky top-0 z-40 border-b border-line/80 bg-background/85 backdrop-blur-md"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setMenuOpen(false);
        }
      }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary-light text-primary"
                    : "text-muted hover:bg-surface-muted hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {status === "checking" ? (
            <span className="hidden text-xs text-subtle sm:inline" role="status" aria-live="polite">
              Checking session…
            </span>
          ) : status === "authenticated" && user ? (
            <>
              <span
                className="hidden max-w-[12rem] truncate text-xs text-subtle lg:inline"
                title={user.email}
              >
                {user.email}
              </span>
              <button
                type="button"
                className="btn-ghost hidden sm:inline-flex"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </>
          ) : (
            <Link href="/login" className="btn-ghost hidden sm:inline-flex">
              Sign in
            </Link>
          )}

          <Link href="/dashboard" className="btn-primary hidden sm:inline-flex">
            Open workspace
          </Link>

          <button
            type="button"
            className="btn-ghost min-h-10 min-w-10 px-2 md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMenuOpen((current) => !current)}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
            >
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div
          id="mobile-navigation"
          className="border-t border-line bg-background px-4 pb-4 pt-3 md:hidden"
        >
          <nav aria-label="Mobile">
            <ul className="space-y-1">
              {LINKS.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "flex min-h-11 items-center rounded-lg px-3 text-sm font-medium",
                        active
                          ? "bg-primary-light text-primary"
                          : "text-muted hover:bg-surface-muted hover:text-foreground",
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-3 border-t border-line pt-3">
            {status === "authenticated" && user ? (
              <>
                <p className="truncate px-1 text-xs text-subtle">Signed in as {user.email}</p>
                <button
                  type="button"
                  className="btn-secondary mt-2 w-full"
                  onClick={handleSignOut}
                  disabled={signingOut}
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </>
            ) : status === "checking" ? null : (
              <Link
                href="/login"
                className="btn-secondary w-full"
                onClick={() => setMenuOpen(false)}
              >
                Sign in
              </Link>
            )}

            <Link
              href="/dashboard"
              className="btn-primary mt-2 w-full"
              onClick={() => setMenuOpen(false)}
            >
              Open workspace
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
