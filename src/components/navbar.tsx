"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Workspaces" },
  { href: "/contracts", label: "Contracts" },
  { href: "/impact", label: "Impact Reports" },
  { href: "/history", label: "History" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200/60 bg-background/80 backdrop-blur-md dark:border-slate-800/50 dark:bg-background/80">
      <div className="flex items-center justify-between px-4 py-3 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold text-sm shadow-sm">
            CR
          </span>
          <span className="font-semibold text-primary tracking-tight">ContractRipple</span>
        </Link>

        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${
                pathname === link.href
                  ? "text-primary"
                  : "text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-primary-400"
              } transition-colors`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary transition-colors">
            Sign in
          </button>
          <Link href="/signup" className="btn-primary">
            Get started
          </Link>
        </div>
      </div>
    </nav>
  );
}
