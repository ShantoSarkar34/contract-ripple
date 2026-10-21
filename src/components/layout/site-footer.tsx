import Link from "next/link";
import { BrandMark } from "./logo";

type FooterLink = { href: string; label: string; external?: boolean };

const FOOTER_LINKS: { heading: string; links: FooterLink[] }[] = [
  {
    heading: "Product",
    links: [
      { href: "/contracts", label: "Contract workspace" },
      { href: "/#impact-demo", label: "Demo impact report" },
      { href: "/login", label: "Sign in" },
    ],
  },
  {
    heading: "Project",
    links: [
      {
        href: "https://github.com/ShantoSarkar34/contract-ripple",
        label: "Source code",
        external: true,
      },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <BrandMark />
              <span className="text-sm font-semibold tracking-tight">ContractRipple</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">
              Compare OpenAPI contracts, trace changed operations into frontend source evidence,
              and export the review.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:gap-16">
            {FOOTER_LINKS.map((group) => (
              <div key={group.heading}>
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">
                  {group.heading}
                </h2>
                <ul className="mt-3 space-y-2">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      {link.external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-sm text-muted transition-colors hover:text-foreground"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="text-sm text-muted transition-colors hover:text-foreground"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 border-t border-line pt-4 text-xs text-subtle">
          <p>
            Landing-page examples are labeled demo data. Workspace results come from your own saved
            analyses.
          </p>
        </div>
      </div>
    </footer>
  );
}
