"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";

const NAV_LINKS = [
  { href: "/", label: "Overview" },
  { href: "/contracts", label: "Workspace" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export default function Navbar() {
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
    <nav
      className="sticky top-0 z-40 border-b border-slate-200/60 bg-background/80 backdrop-blur-md dark:border-slate-800/50 dark:bg-background/80"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setMenuOpen(false);
        }
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 md:px-8">
        <Link href="/" className="flex items-center gap-2" onClick={() => setMenuOpen(false)}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold text-sm shadow-sm">
            CR
          </span>
          <span className="font-semibold text-primary tracking-tight">ContractRipple</span>
        </Link>

        <div className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex dark:text-slate-300">
          {NAV_LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`${
                  active
                    ? "text-primary"
                    : "text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-primary"
                } transition-colors`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {status === "checking" ? (
            <span className="hidden text-xs text-slate-400 sm:inline dark:text-slate-500">
              Checking session…
            </span>
          ) : status === "authenticated" && user ? (
            <>
              <span
                className="hidden max-w-[12rem] truncate text-xs text-slate-500 sm:inline dark:text-slate-400"
                title={user.email}
              >
                {user.email}
              </span>
              <button
                type="button"
                className="btn-ghost"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </>
          ) : (
            <Link href="/login" className="btn-ghost">
              Sign in
            </Link>
          )}
          <Link href="/contracts" className="btn-primary hidden sm:inline-flex">
            Open workspace
          </Link>
          <button
            type="button"
            className="btn-ghost px-2 md:hidden"
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
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div
          id="mobile-navigation"
          className="border-t border-slate-200/70 px-4 py-3 md:hidden dark:border-slate-800/70"
        >
          <ul className="space-y-1">
            {NAV_LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-md px-3 py-2 text-sm font-medium ${
                      active
                        ? "bg-primary-light text-primary dark:bg-slate-800 dark:text-primary"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                    onClick={() => setMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {status === "authenticated" && user ? (
            <div className="mt-3 border-t border-slate-200/70 pt-3 dark:border-slate-800/70">
              <p className="truncate px-1 text-xs text-slate-500 dark:text-slate-400">
                Signed in as {user.email}
              </p>
              <button
                type="button"
                className="btn-ghost mt-2 w-full justify-center"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          ) : status === "checking" ? null : (
            <Link
              href="/login"
              className="btn-ghost mt-3 w-full justify-center"
              onClick={() => setMenuOpen(false)}
            >
              Sign in
            </Link>
          )}

          <Link
            href="/contracts"
            className="btn-primary mt-2 w-full sm:hidden"
            onClick={() => setMenuOpen(false)}
          >
            Open workspace
          </Link>
        </div>
      ) : null}
    </nav>
  );
}
