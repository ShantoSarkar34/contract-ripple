import { cn } from "@/lib/cn";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("card", className)} />;
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("px-5 pt-5", className)} />;
}

export function CardTitle({
  className,
  as: Tag = "h2",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & {
  as?: "h2" | "h3" | "h4";
}) {
  return (
    <Tag
      {...props}
      className={cn("text-base font-semibold tracking-tight text-foreground", className)}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} className={cn("mt-1 text-sm leading-6 text-muted", className)} />;
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("p-5", className)} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn("flex flex-wrap items-center gap-2 border-t border-line px-5 py-3", className)}
    />
  );
}
