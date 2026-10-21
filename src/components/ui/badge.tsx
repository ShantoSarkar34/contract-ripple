import { cn } from "@/lib/cn";

export type BadgeTone =
  | "neutral"
  | "primary"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "outline";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-strong text-muted",
  primary: "bg-primary-light text-primary",
  accent: "bg-accent/10 text-accent",
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-warning",
  danger: "bg-danger-light text-danger",
  outline: "border border-line-strong bg-surface text-muted",
};

export function Badge({
  tone = "neutral",
  className,
  withDot = false,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  withDot?: boolean;
}) {
  return (
    <span {...props} className={cn("badge", TONES[tone], className)}>
      {withDot ? (
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      ) : null}
      {props.children}
    </span>
  );
}
