import Link from "next/link";
import { Alert } from "@/components/ui/alert";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-subtle">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
            {index > 0 ? (
              <span aria-hidden="true" className="text-line-strong">
                /
              </span>
            ) : null}
            {item.href ? (
              <Link href={item.href} className="truncate transition-colors hover:text-primary">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate font-medium text-foreground">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function LoadFailure({
  title,
  message,
  details,
  onRetry,
}: {
  title: string;
  message: string;
  details?: string[];
  onRetry?: () => void;
}) {
  return (
    <Alert tone="danger" title={title} live>
      <p>{message}</p>
      {details && details.length > 0 ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
      {onRetry ? (
        <button type="button" className="btn-secondary mt-3" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </Alert>
  );
}
