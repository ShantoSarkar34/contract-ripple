"use client";

import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/cn";

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, object, embed, [contenteditable], [tabindex]:not([tabindex="-1"])';

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
} as const;

/**
 * Accessible modal. Handles Escape, backdrop dismissal, focus trapping and
 * focus restoration. `placement="left"` renders a full-height drawer used by
 * the workspace navigation on small screens.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  placement = "center",
  size = "md",
  tone = "default",
  panelClassName,
  bodyClassName,
  panelId,
  closeLabel = "Close dialog",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  placement?: "center" | "left";
  size?: keyof typeof SIZES;
  tone?: "default" | "dark";
  panelClassName?: string;
  bodyClassName?: string;
  panelId?: string;
  closeLabel?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      const items = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((element) => element.getClientRects().length > 0);

      if (items.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const firstItem = items[0];
      const lastItem = items[items.length - 1];

      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const isDrawer = placement === "left";

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex bg-slate-950/55 backdrop-blur-[2px]",
        isDrawer ? "justify-start" : "items-start justify-center overflow-y-auto p-4 sm:items-center",
      )}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative bg-surface text-foreground shadow-raised focus:outline-none",
          tone === "dark" && "bg-sidebar-ink text-sidebar-foreground",
          isDrawer
            ? "flex h-full w-[min(20rem,85vw)] flex-col rounded-none border-r border-line"
            : cn("w-full rounded-xl border border-line", SIZES[size]),
          panelClassName,
        )}
      >
        <div
          className={cn(
            "flex items-start justify-between gap-4 border-b px-5 py-4",
            tone === "dark" ? "border-sidebar-line" : "border-line",
          )}
        >
          <div>
            <h2 id={titleId} className="text-base font-semibold tracking-tight">
              {title}
            </h2>
            {description ? (
              <p
                id={descriptionId}
                className={cn(
                  "mt-1 text-sm leading-6",
                  tone === "dark" ? "text-sidebar-muted" : "text-muted",
                )}
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className={cn(
              "inline-flex min-h-9 items-center justify-center rounded-lg px-2 transition-colors",
              tone === "dark"
                ? "-mr-2 -mt-1 text-sidebar-muted hover:bg-sidebar-active hover:text-sidebar-foreground"
                : "btn-ghost -mr-2 -mt-1",
            )}
            onClick={onClose}
            aria-label={closeLabel}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4", bodyClassName)}>{children}</div>

        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
