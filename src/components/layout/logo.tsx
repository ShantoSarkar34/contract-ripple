import Link from "next/link";
import { cn } from "@/lib/cn";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary shadow-sm",
        className,
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9.5 8 6 12l3.5 4" />
        <path d="M14.5 8 18 12l-3.5 4" />
      </svg>
    </span>
  );
}

export function Logo({
  href = "/",
  inverted = false,
  className,
}: {
  href?: string;
  inverted?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-lg py-1.5 transition-opacity hover:opacity-90",
        className,
      )}
    >
      <BrandMark />
      <span
        className={cn(
          "text-[15px] font-semibold tracking-tight",
          inverted ? "text-sidebar-foreground" : "text-foreground",
        )}
      >
        ContractRipple
      </span>
    </Link>
  );
}
