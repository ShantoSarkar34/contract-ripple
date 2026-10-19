# ContractRipple — UI Design Review (Phase 1)

This document records specific improvements to the existing UI. **No redesign is performed in
Phase 1.** These are recommendations for Phases 3 and 5, prioritized by impact.

## Current UI inventory

- `navbar.tsx` — sticky navigation, brand mark, four links, sign-in/get-started actions.
- `hero.tsx` — badge, headline, description, two CTAs, decorative gradient blobs.
- `features.tsx` — four feature cards with emoji icons.
- `impact-report-demo.tsx` — demo diff table and "recommended next steps" callout.
- `recent-activity.tsx` — demo review table with colored status pills.
- `app/layout.tsx`, `app/globals.css`, Tailwind v3 design tokens.

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
