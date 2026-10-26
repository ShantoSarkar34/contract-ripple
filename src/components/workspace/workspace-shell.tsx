"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Logo } from "@/components/layout/logo";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";

function DashboardIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function ContractsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  );
}

function ProjectsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 11h18" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  aliases?: readonly string[];
}> = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Projects, contracts, and recent analyses",
    icon: <DashboardIcon />,
  },
  {
    href: "/projects",
    label: "Projects",
    description: "Group contracts and their saved analyses",
    icon: <ProjectsIcon />,
  },
  {
    href: "/contracts",
    label: "Contracts",
    description: "Compare versions, review findings, analyze impact",
    icon: <ContractsIcon />,
  },
  {
    href: "/history",
    label: "History",
    description: "Every saved analysis across projects",
    icon: <HistoryIcon />,
    aliases: ["/analyses"],
  },
];

function isActive(pathname: string, href: string, aliases: readonly string[] = []): boolean {
  return (
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    aliases.some((alias) => pathname === alias || pathname.startsWith(`${alias}/`))
  );
}

function initialsFor(email: string): string {
  return email.slice(0, 2).toUpperCase();
}

function SidebarBody({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const { user, status, signOut } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const sessionLabel = user?.email ?? (status === "checking" ? "Checking session…" : "Not signed in");

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await signOut();
      onNavigate?.();
      router.push("/login");
    } finally {
      setSigningOut(false);
    }
  }, [onNavigate, router, signOut]);

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pt-1">
        <div className="rounded-lg border border-sidebar-line bg-sidebar-surface px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted">
            Workspace
          </p>
          <p className="mt-1 truncate text-sm font-medium text-sidebar-foreground">
            {user ? "Personal workspace" : "Workspace access"}
          </p>
          <p className="truncate text-xs text-sidebar-muted">{sessionLabel}</p>
        </div>
      </div>

      <nav aria-label="Workspace" className="mt-5 flex-1 px-3">
        <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted">
          Workspace
        </p>
        <ul className="mt-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href, item.aliases);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/15 text-sidebar-foreground"
                      : "text-sidebar-muted hover:bg-sidebar-active hover:text-sidebar-foreground",
                  )}
                >
                  <span className={active ? "text-primary" : "text-sidebar-muted"}>{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6 border-t border-sidebar-line p-3">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-active hover:text-sidebar-foreground"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 19l-7-7 7-7" />
            <path d="M3 12h18" />
          </svg>
          Back to site
        </Link>
        {user ? (
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-active hover:text-sidebar-foreground disabled:opacity-60"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 17l5-5-5-5" />
              <path d="M20 12H9" />
              <path d="M12 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h7" />
            </svg>
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        ) : (
          <Link
            href="/login"
            onClick={onNavigate}
            className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-active hover:text-sidebar-foreground"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <path d="M10 17l5-5-5-5" />
              <path d="M15 12H3" />
            </svg>
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}

export default function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activeItem = NAV_ITEMS.find((item) => isActive(pathname, item.href, item.aliases));

  return (
    <div className="min-h-screen bg-surface-muted">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-line bg-sidebar-ink lg:block">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b border-sidebar-line px-5">
            <Logo inverted href="/dashboard" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto py-4">
            <SidebarBody pathname={pathname} />
          </div>
        </div>
      </aside>

      <Dialog
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Workspace navigation"
        description={user?.email}
        placement="left"
        tone="dark"
        panelId="workspace-mobile-navigation"
        bodyClassName="p-0 pt-4"
        panelClassName="w-[min(18rem,85vw)]"
        closeLabel="Close navigation"
      >
        <SidebarBody pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
      </Dialog>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-background/90 px-4 backdrop-blur md:px-6">
          <button
            type="button"
            className="btn-ghost min-h-11 min-w-11 px-2 lg:hidden"
            aria-expanded={drawerOpen}
            aria-controls="workspace-mobile-navigation"
            aria-label={drawerOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setDrawerOpen((open) => !open)}
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
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="hidden text-subtle sm:inline">Workspace</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="hidden h-4 w-4 text-line-strong sm:inline"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
            <span className="truncate font-medium text-foreground">
              {activeItem?.label ?? "Workspace"}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/" className="btn-ghost hidden sm:inline-flex">
              View site
            </Link>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-xs font-semibold text-muted"
              title={user?.email}
            >
              {user ? (
                initialsFor(user.email)
              ) : (
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-subtle" />
              )}
              <span className="sr-only">{user ? `Signed in as ${user.email}` : "Session not loaded"}</span>
            </span>
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="min-h-[calc(100vh-4rem)] focus:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
