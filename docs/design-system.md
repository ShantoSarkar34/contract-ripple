# ContractRipple — design system

Stage 2 of the product redesign introduced a shared token layer, UI primitives, and three route-group
shells. Stage 3 added the authenticated dashboard; Stage 4 added the project, contract, analysis, and
history views. Stage 5 added the responsive table/card layouts, touch-sized controls, form-error
associations, skip-link focus targets, and a visual-only impact map backed by an accessible
relationships table. This document is the reference for the remaining stages so new views stay
consistent.

## Tokens

Tokens live in `src/app/globals.css` as RGB channel variables (`--surface-rgb: 255 255 255`) so
Tailwind opacity modifiers work. `tailwind.config.js` maps them to utilities such as `bg-surface`,
`border-line`, and `text-muted`. Dark values are defined in the `prefers-color-scheme: dark` block;
the product follows the operating-system preference.

| Token | Utility | Light | Dark | Use |
| --- | --- | --- | --- | --- |
| `--background-rgb` | `bg-background` | `#ffffff` | `#020617` | Page background |
| `--surface-rgb` | `bg-surface` | `#ffffff` | `#0f172a` | Cards, inputs, panels |
| `--surface-muted-rgb` | `bg-surface-muted` | `#f8fafc` | `#020617` | Section bands, workspace canvas |
| `--surface-strong-rgb` | `bg-surface-strong` | `#f1f5f9` | `#1e293b` | Segmented controls, hover |
| `--line-rgb` / `--line-strong-rgb` | `border-line` / `border-line-strong` | slate-200 / slate-300 | slate-800 / slate-700 | Dividers, control borders |
| `--muted-rgb` | `text-muted` | `#475569` | `#cbd5e1` | Body copy |
| `--subtle-rgb` | `text-subtle` | `#64748b` | `#94a3b8` | Captions, hints, metadata |
| `--primary-rgb` | `bg-primary`, `text-primary` | `#4f46e5` | `#818cf8` | Brand, links, active state |
| `--primary-hover-rgb` | `hover:bg-primary-hover` | `#4338ca` | `#a5b4fc` | Hover |
| `--primary-soft-rgb` | `bg-primary-light` | `#eef2ff` | `#1e1b4b` | Selected rows, soft badges |
| `--on-primary-rgb` | `text-on-primary` | white | `#0b1220` | Text on solid brand fills |
| `--accent-rgb` | `text-accent` | `#0891b2` | `#22d3ee` | Informational accents only |
| `--success-rgb` / `--success-soft-rgb` | `text-success` / `bg-success-light` | `#15803d` / `#dcfce7` | `#86efac` / `#052e16` | Non-breaking, success |
| `--warning-rgb` / `--warning-soft-rgb` | `text-warning` / `bg-warning-light` | `#92400e` / `#fef3c7` | `#fcd34d` / `#451a03` | Unknown risk, caution |
| `--danger-rgb` / `--danger-soft-rgb` | `text-danger` / `bg-danger-light` | `#b91c1c` / `#fee2e2` | `#fca5a5` / `#450a0a` | Potentially breaking, errors |

Fixed sidebar tokens: `bg-sidebar-ink`, `bg-sidebar-surface`, `border-sidebar-line`,
`text-sidebar-foreground`, `text-sidebar-muted`, `bg-sidebar-active`. These do not flip with the color
scheme.

### Color rules

- Risk levels keep the comparison engine's three values: `potentially_breaking` → danger,
  `unknown` → warning, `non_breaking` → success. Always pair color with the text label.
- `accent` is informational (links to docs, neutral hints). It is never a risk level.
- Solid brand fills use `.btn-primary` or `text-on-primary`; in dark mode the brand is lighter, so
  white text would fail contrast.
- Prefer token utilities over raw `slate-*` in new views. Existing workspace components will be
  migrated during the workspace stages.

## Typography

- Fonts: Geist Sans for UI, Geist Mono for paths, JSON Pointers, evidence, and identifiers.
- Page title: `text-2xl font-semibold tracking-tight sm:text-3xl` (`PageHeader`).
- Section title: `text-lg font-semibold` or `CardTitle` (`text-base`).
- Body: `text-sm leading-6 text-muted`. Captions: `text-xs text-subtle`.
- Uppercase eyebrows: `text-xs font-semibold uppercase tracking-[0.14em]`, primary color.
- Use `tabular-nums` for counts and timestamps when alignment matters.

## Layout

- Marketing content: `mx-auto max-w-6xl px-4 md:px-6`, sections `py-16 md:py-20`.
- Auth: centered `max-w-6xl` grid; on mobile the form appears before the explanatory column.
- Workspace: fixed 256 px sidebar from `lg`; sticky 64 px top bar; content pages own their padding
  (`px-4 py-8 md:px-6 lg:px-8`). Sticky sub-bars inside the workspace use `top-16`.
- Never allow page-level horizontal scrolling. Wide technical tables get a focusable
  `overflow-x-auto` wrapper with a minimum width. The findings and impact-relationship tables become
  stacked cards below `lg`; the summary cards, project lists, and history rows are already cards.
- Dashboard: stats use a 2-up grid below `lg` and 4-up above; the project grid is 2-up from `sm`. The
  risk/count side rail moves below the projects until `xl`, where it becomes a 19rem column. This
  avoids squeezing project cards when the 256 px sidebar and side rail are both present.

## Workspace navigation

The workspace shell exposes only routes that exist:

| Nav item | Routes | Notes |
| --- | --- | --- |
| Dashboard | `/dashboard` | Aggregate overview |
| Projects | `/projects`, `/projects/[projectId]` | Create projects and contracts; open saved analyses |
| Contracts | `/contracts`, `/contracts/[contractId]` | Comparison workspace and read-only version history |
| History | `/history`, `/analyses/[analysisId]` | Cross-project history and saved analysis detail |

Add an entry to `NAV_ITEMS` in `workspace-shell.tsx` in the same change that adds the route, so the
sidebar never shows a dead link. Aliases (for example `/analyses` under History) keep the correct item
active on detail routes. The top-bar breadcrumb derives from the active item.

Inside the workspace the logo returns to `/dashboard`; "Back to site" returns to the marketing site.
Sign-in and "Open workspace" links land on the dashboard. Project and contract pages can open the
comparison workspace with `?project=<id>&contract=<id>`; the workspace preselects those records.

## Data scope

`/dashboard` reuses owner-scoped endpoints instead of an aggregate API. It fetches the project list
once, then the latest saved analysis for each project, capped at 25 projects
(`DASHBOARD_PROJECT_LIMIT`). Project and contract counts are exact; saved-analysis totals cover the
inspected projects and are labeled as partial when the cap or a request failure applies. No count is
estimated or invented. If an aggregate `GET /api/v1/dashboard` is approved later, replace
`src/lib/dashboard.ts` without changing the view.

`/projects` lists every project. `/projects/[projectId]` loads the project and its contracts, then the
latest 10 saved analyses. If the analysis history fails, the project and contracts still render and
the history section shows a retryable warning.

`/contracts/[contractId]` filters the latest 50 project analyses to runs whose baseline or candidate
version belongs to the contract. Both the cap and the filter are stated in the UI; older runs remain
available in the project history.

`/history` reuses the per-project history endpoint. The all-projects view inspects at most 25 projects
and shows the latest 5 analyses from each, merged newest-first and capped at 75 entries
(`src/lib/history.ts`). The selected-project view uses the server's cursor pagination with a page size
of 20. Failures and caps are labeled; no history row is synthesized.

`/analyses/[analysisId]` renders a persisted `AnalysisRunDetailDto` only. Findings, limitations,
reports, source evidence, the impact map, and regression checks come from that run. A failed run is
labeled as failed rather than presented as a clean comparison.


## Components

| Primitive | File | Notes |
| --- | --- | --- |
| `Button` | `components/ui/button.tsx` | `variant` primary/secondary/ghost/danger, sizes sm/md, `loading` |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | `components/ui/card.tsx` | Card padding is owned by the sub-components |
| `Badge` | `components/ui/badge.tsx` | Tones neutral/primary/accent/success/warning/danger/outline, `withDot` |
| `Field`, `Input`, `Textarea`, `Select` | `components/ui/field.tsx` | Caller supplies `id`; `Field` renders label/hint/error ids |
| `Alert` | `components/ui/alert.tsx` | info/success/warning/danger, `role` follows tone |
| `Skeleton`, `SkeletonText`, `SkeletonCard`, `EmptyState` | `components/ui/feedback.tsx` | Skeletons are `aria-hidden` |
| `PageHeader` | `components/ui/page-header.tsx` | Eyebrow, title, description, actions, meta |
| `Dialog` | `components/ui/dialog.tsx` | Escape, backdrop, focus trap/restore, scroll lock; `placement="left"` drawer, `tone="dark"` |

Legacy classes `.card`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.input`, `.badge`, `.link`,
and `.skeleton` remain supported and now use the tokens.

## Accessibility checklist

- One `h1` per page; sections use `h2`, cards use `h3`.
- Every form control has a `<label>`; errors are linked with `aria-describedby`/`aria-invalid`, and
  invalid submit focuses the first invalid field.
- Interactive controls are at least 44×44 px. The shared button and input classes use `min-h-11`.
- Focus is always visible; the global `:focus-visible` outline uses `--focus-rgb`. The skip link
  targets a `tabIndex={-1}` `<main>` so keyboard focus moves into the page.
- Loading states use `role="status"`; errors use `role="alert"`.
- Tables need a `<caption>` (visible or `sr-only`); wide tables must scroll rather than clip and the
  scroll wrapper is keyboard-focusable.
- The impact-map SVG is visual only and hidden from assistive technology. The Relationships view is
  the equivalent keyboard- and screen-reader-accessible table with the same evidence; pointer users
  can still select map nodes for the inline detail panel.
- Motion respects `prefers-reduced-motion`.
- Dialogs and drawers must trap focus, close on Escape, and return focus to the trigger.

## Verification

Responsive checks use Chrome DevTools device-metrics emulation at 320, 375, 390, 430, 768, 1024,
1280, and 1440 px, measuring `documentElement.scrollWidth - clientWidth` for each route. The Stage 5
pass used the temporary mock API described in the phase report and checked the mobile card layouts,
sticky navigation, download controls, form errors, keyboard focus, and light/dark themes. Lighthouse
snapshot audits of the marketing, login, workspace, and saved-analysis views returned 100 for
accessibility. The frontend still has no automated browser suite; these checks are manual.
