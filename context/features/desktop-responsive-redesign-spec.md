# Desktop Responsive Redesign

## Overview

The app was built mobile-first (Capacitor target, per `context/coding-standards.md`) and that part
works. Desktop — especially 1920×1200 and above — was never designed for: routed pages stretch
edge-to-edge with no container, the map-centric drawer UI leaves 70%+ of large screens as bare map,
and every component picks its own ad-hoc breakpoint (values seen: 480, 600, 640, 767/768, 1024,
1100px — nothing at 1280px+). This is the umbrella plan for fixing that across every page and every
drawer-hosted feature, phased into separate implementation specs/branches (mirroring how
`trip-planner-rebuild-spec.md` phased the wizard rebuild).

This document is the plan only — no code changes. Each phase below gets its own spec + feature
branch before implementation starts, per [[feedback_spec_branch_workflow]].

## Confirmed decisions

- **Map + content drawers become a persistent, non-modal split-view sidebar at desktop.** Today's
  `p-drawer` panels (destination-detail, all-attractions/attraction-detail, hikes/hike-detail,
  bikes/bike-detail, weather, connections, the trip-planner wizard) are `modal: true` overlays with a
  scrim — you can't interact with the map while one is open, and reaching the map requires closing
  or collapsing the panel. At desktop widths this must change to a true split layout: sidebar and map
  sit side by side as siblings, both fully interactive at the same time — sidebar links/buttons and
  map pan/zoom/marker-click all reachable without opening/closing/collapsing anything. Below the
  split-view breakpoint, today's overlay-drawer behavior is unchanged (mobile/tablet UX is not being
  touched). Note this is a **different** pattern from the collapse/expand approach the user already
  rejected for mobile ([[feedback_drawer_pattern]]) — that was a mobile partial-collapse toggle; this
  is a desktop-only, always-both-visible split pane, not a collapse mechanism.
- **Layout code moves to Tailwind v4 responsive utilities.** `coding-standards.md` already says
  "prefer utility classes over custom CSS" and "consistent spacing scale," but the audit found
  Tailwind is barely used — nearly everything is hand-written per-component CSS with inconsistent
  breakpoints and no shared scale. Going forward, new/touched layout code uses `lg:`/`xl:`/`2xl:`
  utility classes against a breakpoint scale defined once via Tailwind's `@theme` (in `styles.css`,
  since there's no separate Tailwind config file today), instead of hand-rolled `@media` blocks.
  Existing bespoke CSS for visual detail (colors, card chrome, animations) is not being ripped out
  wholesale — this is specifically about how *responsive layout* is expressed.

## Current-state summary (full detail in the audit that produced this plan)

- **Routes** (`app.routes.ts:14-59`): `/`, `/destinations`, `/destinations/:id`, `/trip-planner(/:id)`,
  `/explore-trips`, `/search`, `/auth/profile`. Everything else (auth screens, attractions, hikes,
  bikes, destination-detail, hotels stub, trip-planner steps, weather, explore-trips filter) is
  reached via the global drawer system layered on `MainLayout`, not via routing.
- **Shell**: `MainLayout` (`shell/main-layout/main-layout.html`) is header + `router-outlet` +
  `drawer-host` + footer, with **empty CSS** — no container, no max-width, content stretches full
  viewport width by default.
- **Header/nav**: `header-nav` has a logo and a single hamburger at every width — **no desktop nav
  bar exists at all**. All nav links live inside the 300px-wide `menu-nav` drawer.
- **Footer**: correctly desktop-hidden already (`footer-nav.css:55-59`, `min-width: 600px`).
- **Map shells** (`destinations-layout`, `trip-planner-layout`): `position: fixed; inset: 0`, map/
  wizard always fills 100% of viewport; drawers (300–600px hard caps) and floating "reopen" pill
  buttons float on top. This is the dominant pattern and the biggest visual gap on large screens.
- **Trip planner wizard** (steps 1–5): single-column, full-width, essentially zero responsive CSS
  (`step1-my-trip.css`, `step4-summary.css`, `step5-save.css` have no media queries at all).
- **Content grids**: `explore-trips` caps at 3 columns above 1100px forever; `profile` trips-grid
  caps at 2 columns above 768px; `destination-horizontal-list` uses a fixed-width horizontal scroll
  strip that never becomes a grid. `destination-vertical-list` (1200px container + 1024px row-layout
  switch) and `home.css`'s hero/typography scale-up at 1024px are the closest things to existing
  desktop-aware precedent, and even those stop short of anything past ~1100–1200px.
- **No shared component library** — buttons/cards are hand-rolled per feature, sometimes duplicated
  verbatim (`.reopen-btn` in both `trip-planner-layout.css` and `destinations-layout.css`;
  `.destination-card` in both horizontal- and vertical-list CSS).

## Open questions to resolve before writing Phase 1's spec

These affect the split-view design directly and are worth deciding up front rather than mid-phase:

1. **Split-view breakpoint.** Candidates: `lg` (1024px, Tailwind default) vs `xl` (1280px). 1024px is
   likely too cramped for map + a useful sidebar simultaneously (a small laptop at 1024 would get a
   squeezed map). Leaning `xl` (1280px) as the cutover, overlay-drawer behavior below it.
2. **Sidebar width at desktop.** Today's drawers cap at 300–600px. A wider fixed sidebar (proposal:
   ~420px, growing to ~480px at `2xl`/1536px+) gives content room without starving the map, which
   should stay the visual focus per `project-overview.md`'s "map should always feel central."
3. **Stacked drawers.** The `Drawer` service supports a `stack` (e.g. destination-detail + weather
   open together). Overlay stacking (drawers layered/slid) doesn't translate directly to a sidebar —
   need to decide: tabs within one sidebar column, multiple stacked sidebar columns, or the second
   item replacing the first in place. Recommend starting with "replace in place" (simplest, matches
   current effective mobile behavior) and revisiting if it feels wrong in review.
4. **Global site nav** (`menu-nav`, currently a 300px drawer reached via hamburger at every width) —
   should it become a persistent horizontal desktop nav bar in the header, independent of the
   map-sidebar work above? The audit found zero desktop nav pattern here; recommend yes, scoped as
   its own phase since it's unrelated to the map/drawer split-view mechanism.

## Phase 0 — Foundations

Establishes the shared primitives every later phase depends on, so they aren't reinvented per phase.

- Add a `@theme` block to `frontend/src/styles.css` (no separate Tailwind config file exists today)
  defining the project's breakpoint scale — Tailwind defaults (`sm`640 `md`768 `lg`1024 `xl`1280
  `2xl`1536) plus a wide tier for 1920+ if content-grid tiers need it (Phase 3).
  Once questions 1–2 above are settled, encode them here (e.g. `--breakpoint-split: 1280px`... though
  Tailwind's generated `xl:` prefix may just be reused directly rather than a custom named breakpoint).
- Establish a shared page container convention (max-width + centered + responsive padding) as a
  Tailwind utility combo or a tiny shared class, replacing the one-off containers already duplicated
  differently in `destination-vertical-list.css` (1200px), `home.css` (2000px), `search-page.css`/
  `search-box.css` (900px).
- Design and build the reusable **split-view shell** (sidebar + map, non-modal, both interactive) as
  a shared layout piece so `destinations-layout` and `trip-planner-layout` don't each reimplement it.
  This is the highest-risk/highest-value piece of the whole plan and should be prototyped against one
  screen (recommend `destinations-layout`, the simpler of the two map shells) before Phase 1 rolls it
  out everywhere.
- Start a `shared/components/` (or `shared/ui/`) folder for the first deduplicated primitives this
  work will need anyway: the reopen/pill button, base card. Full component-library buildout is
  Phase 4, but don't let Phase 1 create a third copy of `.reopen-btn`.

## Phase 1 — Map shells → split-view sidebar

Scope: `destinations-layout`, `trip-planner-layout`, and every drawer they host — destination-detail,
all-attractions/attraction-detail, hikes-list/hike-detail, bikes-list/bike-detail, weather,
connections, and the trip-planner wizard (steps 1–5, see Phase 2 for the wizard's own internal
layout). At/above the split-view breakpoint, these render in the Phase 0 sidebar shell instead of a
`p-drawer` overlay; below it, unchanged. Floating "reopen" buttons become desktop-irrelevant (nothing
to reopen — the sidebar is always present) and only render at mobile/tablet widths where the overlay
pattern still applies.

## Phase 2 — Trip planner wizard (steps 1–5)

The wizard already lives inside the Phase 1 sidebar shell; this phase is about what happens *inside*
that column. Currently `.tp-wizard-host` is forced full-viewport-width (`left:0;right:0`) with
single-column, padding-only, near-zero responsive CSS per step. Once it's constrained to the sidebar
width from Phase 1, most of the "stretched full-width column" problem disappears structurally — this
phase is the remaining tuning pass (spacing/typography density, side-by-side field rows like the
existing Start/End Date precedent from `trip-planner-page-redesign-spec.md`) rather than a rebuild.

## Phase 3 — Content pages (home, destinations list, explore-trips, search, profile)

Pages that are full routed pages (not map shells) and just need their existing grids/typography to
keep scaling past today's ~1024–1100px ceiling, using Tailwind `lg:`/`xl:`/`2xl:` utilities per the
CSS-approach decision above:

- `explore-trips`: add `xl`/`2xl` column tiers instead of capping at 3 columns forever.
- `profile` saved-trips grid: add a 3rd column tier at `xl`.
- `destination-horizontal-list` (`frontend/src/app/features/destinations/destination-horizontal-list/
  destination-horizontal-list.css:83-127`): **called out explicitly as a priority** — cards are fixed
  at 160px (mobile) / 200px (≥768px) and never grow again, so the three homepage rails (City Breaks,
  Mountains, Nature Parks — `home.html:37-75`) show the same small card at 1920px as at 768px. Add
  `lg`/`xl`/`2xl` size tiers (e.g. ~240px at `lg`, ~280px at `xl`+), evaluating grid vs. wider
  scroll-strip cards at the same time per the original open question.
- `home`: replace the ad-hoc 2000px container with the Phase 0 shared container; extend the
  1024px-only hero/typography scale-up with further `xl`/`2xl` tiers.
- Use `destination-vertical-list.css` (existing 1200px container + 1024px photo-left row layout) as
  the style precedent — it's the most desktop-aware component in the app today.

## Phase 4 — Shared component library

Once Phases 1–3 have surfaced the real repeated primitives (sidebar shell, pill/reopen button, cards,
form fields), formalize them into `shared/components/` with explicit desktop variants, and retrofit
the duplicated bespoke CSS this audit found (`.reopen-btn` ×2, `.destination-card` ×2, and likely more
surfaced during Phases 1–3) to use the shared versions instead.

## Phase 5 (separate track) — Global site nav

Independent of the map-sidebar work: give `header-nav` a real horizontal desktop nav row (`lg:flex` or
similar) sourced from the same links `menu-nav` already has, with the hamburger + drawer remaining as
the sub-`lg` behavior. Sequenced separately since it touches global chrome rather than any one
feature, and doesn't block or depend on Phases 1–4.

## Sequencing note

Recommended order: **Phase 0 → Phase 1 (prototype on destinations-layout, then extend to
trip-planner-layout) → Phase 2 → Phase 3 → Phase 4**, with **Phase 5** slotted in whenever convenient
since it's independent. Phase 1 is both the biggest UX change and the biggest unknown (the
non-modal split-view shell doesn't exist yet anywhere in the app) — worth a design review after the
`destinations-layout` prototype, before sinking the same pattern into `trip-planner-layout` and all
the other drawer-hosted features.

## Verification approach (whole initiative)

Each phase's own spec will have its own verification section, but every phase should be checked at
minimum at 1280px, 1440px, 1920×1200px, plus a spot-check that nothing regressed below the split-view
breakpoint (existing mobile/tablet behavior must stay pixel-for-pixel where this plan doesn't
explicitly touch it).

## References

- @context/coding-standards.md
- @context/project-overview.md
- @context/features/trip-planner-rebuild-spec.md (phasing precedent)
- @context/features/trip-planner-page-redesign-spec.md (Step 1 side-by-side field precedent)
- @context/features/responsive-nav-spec.md (prior, narrower responsive pass — footer/hero/auth-drawer
  only, superseded in scope by this plan)
- @frontend/src/app/app.routes.ts
- @frontend/src/app/shell/main-layout/, header-nav/, footer-nav/, menu-nav/
- @frontend/src/app/shell/destinations-layout/, trip-planner-layout/
- @frontend/src/app/shared/drawer-host/, shared/services/drawer.ts
- @frontend/src/app/features/trip-planner/ (step1-my-trip … step5-save)
- @frontend/src/app/features/destinations/destination-vertical-list/ (existing desktop-aware precedent)
- @frontend/src/app/features/explore-trips/, features/home/, features/search/, features/auth/profile/
- @frontend/src/styles.css
