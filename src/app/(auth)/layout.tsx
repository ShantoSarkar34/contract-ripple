import Link from "next/link";
import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-muted">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <header className="border-b border-line bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <Logo />
          <Link href="/" className="btn-ghost" aria-label="Back to overview">
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
            <span className="hidden sm:inline">Back to overview</span>
            <span className="sm:hidden">Back</span>
          </Link>
        </div>
      </header>

      <main id="main-content" className="flex flex-1 items-center py-8 sm:py-12">
        {children}
      </main>
    </div>
  );
}
