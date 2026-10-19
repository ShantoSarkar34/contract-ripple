"use strict";

import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/80 backdrop-blur-md dark:border-slate-700/50">
      <div className="flex items-center justify-between px-4 py-3 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-white font-bold text-sm shadow-sm">
            CR
          </span>
          <span className="font-semibold text-brand tracking-tight">ContractRipple</span>
        </Link>

        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-700 dark:text-slate-300">
          <Link href="/" className="hover:text-brand transition-colors">Workspaces</Link>
          <Link href="/contracts" className="hover:text-brand transition-colors">Contracts</Link>
          <Link href="/impact" className="hover:text-brand transition-colors">Impact Reports</Link>
          <Link href="/history" className="hover:text-brand transition-colors">History</Link>
        </div>

        <div className="flex items-center gap-3">
          <button className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-brand transition-colors">
            Sign in
          </button>
          <Link
            href="/signup"
            className="px-4 py-2 text-sm font-medium text-white bg-brand rounded-md hover:bg-brand-600 transition-colors shadow-sm"
          >
            Get started
          </Link>
        </div>
      </div>
    </nav>
  );
}
