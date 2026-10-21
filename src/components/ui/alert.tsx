import { cn } from "@/lib/cn";

export type AlertTone = "info" | "success" | "warning" | "danger";

const TONES: Record<AlertTone, { box: string; title: string }> = {
  info: { box: "border-primary/25 bg-primary-light text-foreground", title: "text-primary" },
  success: { box: "border-success/25 bg-success-light text-foreground", title: "text-success" },
  warning: { box: "border-warning/25 bg-warning-light text-foreground", title: "text-warning" },
  danger: { box: "border-danger/25 bg-danger-light text-foreground", title: "text-danger" },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
  live = false,
}: {
  tone?: AlertTone;
  title?: string;
  children?: React.ReactNode;
  className?: string;
  live?: boolean;
}) {
  const styles = TONES[tone];

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      aria-live={live || tone === "danger" ? "polite" : "off"}
      className={cn("rounded-lg border px-4 py-3 text-sm leading-6", styles.box, className)}
    >
      {title ? <p className={cn("font-semibold", styles.title)}>{title}</p> : null}
      {children ? <div className={cn(title && "mt-1", "text-foreground/90")}>{children}</div> : null}
    </div>
  );
}
