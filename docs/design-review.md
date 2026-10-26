# ContractRipple — UI Design Review (Phase 1)

This document records specific improvements to the existing UI. **No redesign is performed in
Phase 1.** These are recommendations for Phases 3 and 5, prioritized by impact.

## Phase 5 resolution

Phase 5 addressed the application-shell, density, accessibility, typography, and theming
recommendations:

- **Application shell:** the workspace now has a sticky context bar showing the selected project,
  contract, and anchors to the comparison report and impact map. The navbar no longer exposes dead
  `/impact` or `/signup` routes; `/history` is now a real all-projects history route. The header
  includes a keyboard-operable mobile menu.
- **Typography:** the Geist font variables loaded by `layout.tsx` are applied to the body, and
  monospace is used for code paths and evidence.
- **Information density:** comparison findings are a dense, filterable table (risk, category,
  method, search) with expandable explanation/evidence rows and incremental "Show more".
- **Graph with fallback:** the impact map is a deterministic SVG. A Map/Relationships toggle exposes
  the same evidence as a semantic table for keyboard and screen-reader users, and operations without
  a persisted source match remain visible.
- **Accessibility:** global `:focus-visible` outlines cover links, buttons, and summaries; tables
  have captions; risk uses text as well as color; decorative feature emoji are hidden; reduced-motion
  preferences are respected.
- **Color and theming:** Tailwind now uses `darkMode: "media"`, matching the `prefers-color-scheme`
  CSS variables instead of the previous inactive class strategy. Background/foreground tokens are
  wired through RGB variables so alpha utilities work.
- **States:** the graph and table show explicit empty, filtered, unmatched, truncation, and
  static-analysis limitation text.

## Phase 6 resolution

Phase 6 addressed history and export UX:

- **History:** the workspace loads 20 saved comparisons at a time, shows loaded/total counts, marks
  the active comparison, includes date/change/truncation metadata, and offers an explicit "Load more"
  control. Loading, empty, error, and retry states are separate from the comparison content.
- **Exports:** JSON and Markdown download controls sit in the comparison report header, report
  failures are shown inline, and the UI explains that exports contain findings, suggestions, and the
  latest source analysis.
- **Regression checks:** a dedicated section lists operation-scoped review prompts with risk,
  method/path, suggested checks, and expandable evidence. Empty states explain when no
  operation-scoped findings exist. The copy makes clear that these are not executable tests.
- **Navigation:** the sticky context bar links to the regression-check section as well.

Remaining, deferred to later phases: sortable table columns, a sticky table header, and
authentication-aware UI (Phase 7). A manual theme toggle is not required while the app follows the
operating-system preference.

## Phase 8 — product redesign

The redesign is being delivered in stages. Stage 1 audited the live UI; Stage 2 replaced the global
navbar with three purpose-built shells and consolidated the visual system.

### Stage 2 — design system and application shells

- **Route groups:** `(marketing)`, `(auth)`, and `(workspace)` now own their layouts. The root layout
  only provides the document, fonts, and `AuthProvider`. URLs are unchanged (`/`, `/login`,
  `/contracts`).
- **Marketing shell:** `components/layout/site-header.tsx` + `site-footer.tsx`. The header keeps the
  session-aware actions, uses a 64 px sticky bar, and the mobile menu is a disclosure with
  `aria-expanded`/`aria-controls`, Escape handling, and 44 px touch targets. The dead `/impact` CTA
  now scrolls to `#impact-demo`; the demo surfaces carry visible "Sample data" / "Demo data" labels.
- **Authentication shell:** `(auth)/layout.tsx` adds a minimal brand bar with a back link; the form is
  ordered first on small screens and field-level email/password checks run before the request.
- **Workspace shell:** `components/workspace/workspace-shell.tsx` provides a fixed dark sidebar
  (256 px) from `lg`, a 64 px sticky top bar with breadcrumb and account, and a mobile navigation
  drawer built on the shared `Dialog`. The drawer traps focus, closes on Escape, locks page scroll,
  restores focus, and is labelled by its heading. `aria-current` marks the active page.
- **Design tokens:** page, surface, line, muted text, brand, accent, focus, and paired status colors
  live as RGB channel variables in `globals.css`; light and dark values are defined per token. Status
  text/background pairs were re-picked for contrast (accessibility score moved from 0.96 to 1.00).
  The sidebar uses fixed dark tokens in both schemes.
- **Primitives:** `components/ui/` adds `Button`, `Card` (+ header/title/description/content/footer),
  `Badge`, `Field`/`Input`/`Textarea`/`Select`, `Alert`, `Skeleton`/`SkeletonText`/`SkeletonCard`,
  `EmptyState`, `PageHeader`, and an accessible `Dialog`.
- **Chrome fixes:** the demo impact table is now horizontally scrollable with an accessible caption,
  the recent-activity table has a caption and a visible demo badge, feature emoji were replaced with
  stroke icons, and the decorative hero blobs were removed.
- **Verified:** no page-level horizontal overflow at 320, 375, 390, 430, 768, 1024, 1280, or 1440 px
  on `/`, `/login`, and `/contracts`. Lighthouse accessibility on `/` is 1.00.

Stages 3–5 resolved the remaining layout and form items: authenticated workspace routes, mobile card
layouts for the findings and relationships tables, and per-field validation associations. Graph
keyboard selection was intentionally not added: the SVG map is visual-only and hidden from assistive
technology, while the Relationships table is the equivalent keyboard-accessible view. A manual theme
toggle is still not required because the product follows the OS preference.

### Stage 6 — final review

The final review checked all redesign stages together and fixed the remaining defects:

- Project and contract switches now clear the previous project's contract and version state before
  loading, and failed requests no longer leave stale selectors that can submit the wrong version IDs.
- A failed contract creation no longer leaves the versions panel stuck on "Loading versions…".
- Source-impact history failures now offer Retry and no longer show a contradictory "no analysis"
  empty state when snapshot summaries exist.
- The mobile workspace navigation trigger now toggles, so its accessible name matches its action.
- Dialogs render in a body portal, mark background content `inert`/`aria-hidden`, and keep Shift+Tab
  inside the panel.
- Baseline/candidate content labels are associated with the textareas, version labels enforce the
  120-character limit, project-form hints are referenced by `aria-describedby`, and report export
  buttons announce their format.
- Findings durations and contract sizes use the shared formatters; the analysis sidebar distinguishes
  a loading project from an unavailable one; the dashboard labels the latest review as partial when
  only some project histories were loaded.

Verification results are recorded in `docs/design-system.md` and the Stage 6 completion report.
The final production-build pass checked 80 route/width combinations with no overflow, no broken
internal links, and one visible main/`h1` per route; dialog and mobile-drawer focus behavior passed,
and Lighthouse returned 100 for Accessibility, Best Practices, and SEO on nine public and
authenticated views.

## Current UI inventory

- `components/layout/` — brand mark, marketing header/footer.
- `components/workspace/workspace-shell.tsx` — sidebar, top bar, mobile drawer, account actions.
- `components/ui/` — cards, buttons, badges, fields, alerts, skeletons, empty states, dialog.
- `hero.tsx`, `features.tsx`, `impact-report-demo.tsx`, `recent-activity.tsx` — landing sections,
  with demo content labeled.
- `app/(marketing)`, `app/(auth)`, `app/(workspace)` — route-group layouts; `app/globals.css` and
  `tailwind.config.js` hold the token system.

## Typography

- Headline uses `font-extrabold`; body copy is default sans. Establish a small, explicit type scale
  (display / h1 / h2 / h3 / body / caption) instead of ad hoc sizes.
- Use the Geist font variables already loaded in `layout.tsx`; the body currently falls back to
  Arial, so the loaded font is unused. Apply `font-sans` at the body or map it in Tailwind.
- Use tabular/monospace numerals for versions, counts, and code paths to improve scanning.

## Spacing

- Section padding is inconsistent between `py-16` and `py-24`. Standardize vertical rhythm.
- Card padding varies; adopt a single spacing scale (4/8/12/16/24/32).
- Tighten table cell padding on mobile; current `px-6 py-4` is wide for small screens.

## Layout and hierarchy

- The page is a single long marketing scroll with no real app shell. Phase 5 should introduce an
  application layout (sidebar or top-level project navigation) distinct from the landing page.
- Demo tables should be visually separated from real project data and paired with a persistent
  "Demo" label, not only a footnote.
- The "Recommended next steps" callout competes with the table; give findings primary visual weight
  and make the callout secondary.

## Accessibility

- Ensure every interactive element has a visible focus ring (the design tokens define ring styles but
  links/buttons do not consistently use them).
- Emoji feature "icons" are decorative but announced by screen readers; mark them `aria-hidden` and
  provide text labels.
- Color-only status encoding (green/amber/red) must be paired with text labels (already partially
  done) and sufficient contrast.
- Tables need `<caption>` or `aria-label`; the demo tables currently lack accessible names.
- Check heading order: one `h1` per page, then `h2`/`h3` without skips.
- The nav lacks a mobile menu; links are hidden below `md` with no replacement.

## Information density

- Demo tables use generous spacing that works for a landing page but not for an analysis tool.
  Phase 5 should use denser, scannable rows with sticky headers and sortable/filterable columns.
- Add explicit empty, loading, error, and partial-result states; the current UI only has demo data.
- Long endpoint paths should truncate with access to the full value (title/tooltip or expandable row).

## Color and theming

- The primary/secondary system is consistent, but dark mode relies on `prefers-color-scheme` while
  `darkMode: "class"` is configured in Tailwind. Decide on one strategy; class-based theming needs a
  ThemeProvider and a toggle.
- Semantic colors (success/warning/danger) are reused for both change types and review statuses.
  Ensure the same color always means the same thing, or introduce distinct tokens.

## Priority order for later phases

1. Phase 3: real loading/empty/error states, accessible tables, demo labeling, mobile nav.
2. Phase 5: application shell, dense findings views, filters, graph with list fallback, focus states.
3. Phase 6: report/export views and history pagination.
