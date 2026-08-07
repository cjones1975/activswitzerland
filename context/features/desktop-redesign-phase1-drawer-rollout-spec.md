# Desktop Redesign Phase 1: Roll Out Split-View to the Rest of `destinations-layout`'s Drawers

Continuation of `context/features/desktop-redesign-phase0-foundations-spec.md`, same branch
(`feature/desktop-split-view-foundations`, still uncommitted) — Phase 0's `destination-detail`
prototype was live-reviewed by the user and confirmed working (docked panel + map reflow + no
header overlap + footer-nav hidden on desktop, all fixed in the same round). This spec covers
applying the identical mechanism to every other drawer `destinations-layout` can host.

## Scope

All-Attractions, Attraction Detail, Weather, Hikes, Hike Detail, Bikes, Bike Detail, Hotels — every
`DrawerKey` `destinations-layout.ts` itself opens (`onMarkerClick`, `listAllAttractions`,
`reopenHikes`/`reopenBikes`, and destination-detail's own Hotels/Weather links). Still explicitly
**out of scope**: `connections` and the trip-planner wizard itself — both belong to
`trip-planner-layout`, a structurally different full-width shell, not a narrow drawer over a map
(master plan's Phase 2).

## A scope leak the naive version would have caused, and how it's avoided

`DrawerHost` is a single global singleton (mounted once in `MainLayout`, used on every route) — so
`[modal]="!breakpoint.isDesktopSplitView()"` on, say, the `all-attractions` drawer would have applied
everywhere that drawer is used, not just on `/destinations/:id`. But six of these drawers are *also*
reused by the trip-planner wizard's Step 3 "Activities" as `mode: 'select'` pickers (all-attractions,
attraction-detail, hikes, hike-detail, bikes, bike-detail — per
`trip-planner-rebuild-spec.md`/`trip-planner-activities-spec.md`), opened while `/trip-planner` is the
active route — a different component (`TripPlannerLayout`), not `DestinationsLayout`, and not touched
by this phase. Undocking those would have left a non-modal, CSS-repositioned panel floating over the
trip-planner wizard with no reflow on that side (`trip-planner-layout` doesn't know about any of
this), and no scrim — visually broken, letting clicks reach wizard content mid-selection.

Fixed by reusing the flags `drawer-host.ts` already computes for exactly this distinction —
`isAllAttractionsTripPlanner()`, `isAttractionDetailTripPlanner()`, `isHikesTripPlanner()`,
`isHikeDetailTripPlanner()`, `isBikesTripPlanner()`, `isBikeDetailTripPlanner()` (each already derived
from the payload's `mode`/`source`, previously only used to hide the "show on map" header button in
trip-planner context). The `[modal]` binding becomes `isXTripPlanner() || !breakpoint.isDesktopSplitView()`
— modal (today's full-overlay behavior, unchanged) whenever opened from the trip-planner wizard,
*or* whenever below the split-view breakpoint; non-modal/docked only in the destinations-page context
at desktop width. `weather` and `hotels` have no trip-planner select mode at all (confirmed — no
`ActivityKind` entry for hotels, no `isWeatherTripPlanner`/`isHotelsTripPlanner` computed exists), so
they dock unconditionally at desktop width, same as `destination-detail`.

The desktop docking CSS (`top`/`height`/`box-shadow`/`border`) is **not** given the same trip-planner
gate — it's purely cosmetic positioning, not a behavior change, and leaving the header visible/usable
even during a still-modal trip-planner picker is a harmless, arguably positive side effect.

## Implementation

- `frontend/src/app/shared/drawer-host/drawer-host.html`: `[modal]` added to all-attractions,
  attraction-detail, weather, hikes, hike-detail, bikes, bike-detail, hotels — the six with a
  trip-planner mode use `isXTripPlanner() || !breakpoint.isDesktopSplitView()`; weather/hotels use
  `!breakpoint.isDesktopSplitView()` directly (matches `destination-detail`, done in Phase 0). New
  `weather-drawer`/`hotels-drawer` classes added to those two `styleClass`es so every drawer now has
  a unique, individually targetable class (six already did).
- `frontend/src/app/shared/drawer-host/drawer-host.css`: the Phase 0 desktop-docking `@media
  (min-width: 1280px)` block's selector list extended to all nine `.dest-drawer`-family classes
  except `.connections-drawer`.
- `frontend/src/app/shell/destinations-layout/destinations-layout.ts`: `sidebarDocked` computed
  extended from checking only `destination-detail` to checking all nine keys (`||`-chained). These
  are mutually exclusive in practice — every flow in this file closes/collapses the previous drawer
  before opening the next (`listAllAttractions()`, `onMarkerClick()`, `reopenHikes()`/`reopenBikes()`)
  — so at most one is ever open, and thus docked, at a time.

No changes to `trip-planner-layout`, `TripPlannerWizard`, or any Step 1-5 component.

## Bug found and fixed during live testing (pre-existing, not caused by this phase)

User reported: with `attraction-detail` open, clicking the header's "ActivSwitzerland" brand link
(`header-nav.html` — a plain `routerLink`, no drawer-aware click handler) navigated home, but the
drawer stayed open, rendered on top of the home page. Root cause: `destinations-layout.ts`'s
`ngOnDestroy()` only ever closed the `destination-detail` key — the other eight drawer keys this page
opens were never closed on navigate-away. Harmless-looking on mobile (still a full-overlay modal
either way) but became obviously visible once these drawers started rendering as non-modal docked
panels — a modal one would at least still block interaction with the page underneath as a hint
something was wrong; a non-modal one just silently persists. Pre-existing bug, not introduced by this
phase — `DrawerHost` is a single global singleton with no route-awareness of its own, so any drawer
left open when its owning page unmounts stays rendered on whatever page comes next. Fixed by closing
all nine keys in `ngOnDestroy()` instead of just `destination-detail`.

## Verification (user to run live in-browser)

- At ≥1280px on a destination page: open Attractions (list, then a detail), Hikes (list, then a
  detail), Bikes (list, then a detail), Weather, and Hotels one at a time — each should dock left
  below the header exactly like `destination-detail` did, map/reopen-buttons shifting to match, no
  scrim, map still interactive.
- Confirm switching between them (e.g. Attractions list -> a marker's Attraction Detail) transitions
  cleanly, one docked panel replacing the previous one, no double-panel overlap.
- On `/trip-planner`, Step 3 "Activities": open the attraction/hike/bike picker in `select` mode at
  ≥1280px — confirm it's still a full modal overlay with a scrim, exactly as before this phase (this
  is the regression this phase specifically had to avoid).
- Below 1280px: every drawer listed above behaves exactly as it did before this phase, on both the
  destinations page and the trip-planner picker flows.

## Part 2: `trip-planner-layout` + the Connections drawer

Completes this phase's original scope (master plan: "Phase 1 — Map shells -> split-view sidebar...
`destinations-layout`, `trip-planner-layout`, and every drawer they host"), on the same branch.

**Structurally different from Part 1.** `destinations-layout` always mounts the map, with drawers
overlaid on top — Part 1 just had to make the overlay non-modal and shift the (already-mounted) map.
`trip-planner-layout` instead used `@if (!tripPlanner.wizardVisible()) { <map> } @else { <wizard,
full-viewport-width> }` — map and wizard were mutually exclusive in the template, never both mounted
at once, and the wizard host was a plain fixed `<div>` (not a `p-drawer`), so there was no `[modal]`
flag to toggle.

**Resolved:**
- New `TripPlannerLayout.showMap` computed: `!tripPlanner.wizardVisible() ||
  breakpoint.isDesktopSplitView()` — the map now also mounts at desktop width whenever the wizard is
  visible (previously never), so both can render together. Below 1280px, behavior is unchanged
  (map only mounts once the wizard is hidden, matching `trip-planner-page-redesign-spec.md`'s
  "land directly on the wizard, no map flash" intent for that breakpoint range).
- New `TripPlannerLayout.wizardDocked` computed: `tripPlanner.wizardVisible() &&
  breakpoint.isDesktopSplitView()` — drives `.tp-wizard-host--docked` (fixed 600px width instead of
  full-viewport, matching every other docked panel's width) and `.map-wrapper--docked` (map's left
  edge shifts to 600px, same mechanism as Part 1).
- `destinations-layout.css`'s `top: 4.5rem` map-wrapper fix (this session's earlier header-seam fix)
  applied here too, proactively, for the same reasoning.
- **Connections drawer**: gets the same `[modal]`/CSS-docking treatment as Part 1's drawers, but at
  trip-planner-layout's own `top: 3.5rem` header clearance (not the `4.5rem` the destinations-page
  group uses — the two components independently settled on different values, neither has shown a
  header-overlap issue at its own value, so each keeps its own rather than forcing a shared number).
  Widened from `480px` to `600px` to match the wizard's docked width: Connections is always opened
  *while the wizard is still visible* (Step 2's "Train Connections" button, Step 4's "Fix connection"
  — neither calls `hideWizard()`), so at desktop width it renders in the exact same docked slot as the
  wizard, on top of it (same z-index relationship as today's mobile modal-over-wizard) — matching the
  width means it fully covers the wizard rather than leaving a sliver of it visible on the right edge.
  This also means the map's left-shift only ever needs to key off `wizardDocked()` — Connections being
  open on top doesn't change how much room the map needs to give up.
- **Same leftover-open-drawer bug as Part 1's `destinations-layout` fix, found proactively this
  time**: `TripPlannerLayout.ngOnDestroy()` called `tripPlanner.reset()`, which only resets the
  wizard's own internal state (trip data, step, `wizardVisible`) — never touches `Drawer`. Any of
  `all-attractions`/`attraction-detail`/`hikes`/`hike-detail`/`bikes`/`bike-detail` (Step 3's
  `mode: 'select'` pickers) or `connections` left open when navigating away from `/trip-planner`
  would have kept rendering on the next page, same as the bug already fixed in `destinations-layout`.
  Fixed the same way — closing all seven keys in `ngOnDestroy()`.

## Bug found and fixed: stuck modal mask after closing a trip-planner picker

User reported: in the trip-planner, opening the Activities picker (e.g. all-attractions in `select`
mode) then closing/collapsing it left the docked wizard behind it permanently unclickable — "does
not regain focus." Suspected (and confirmed) to also affect hikes/bikes; hotels has no trip-planner
mode so was unaffected.

**Root cause**: `Drawer.close(key)` deletes the drawer's payload synchronously, in the same call that
removes it from `stack`. Part 1's `[modal]="isXTripPlanner() || !breakpoint.isDesktopSplitView()"`
bindings read that payload reactively (`isXTripPlanner()` calls `getPayload()`), so the moment
`close()` runs, `isXTripPlanner()` flips to `false` in the very same change-detection cycle that also
sets `[visible]="false"`. Read PrimeNG's `p-drawer` source again: `hide()` only calls
`disableModality()` (the sole path to actually removing the scrim mask from `<body>`) `if
(this.modal)` — and by the time that animation-driven `hide()` fires, Angular has already pushed the
new, stale-false `modal` value into the component. `disableModality()` never runs, the mask is never
removed — left in the DOM, invisible (or mid-fade), but still intercepting every click on whatever
renders underneath.

**Fix**: `drawer-host.ts` gained a `stickyModal(key, isTripPlannerMode)` helper — a `signal(true)`
updated by an `effect()` that only writes a new value `if (this.svc.isOpen(key))`, never during the
close transition. The six affected `[modal]` bindings (`all-attractions`, `attraction-detail`,
`hikes`, `hike-detail`, `bikes`, `bike-detail`) now read `allAttractionsModal()` etc. instead of the
inline expression — PrimeNG always sees the same `modal` value it had when the drawer opened, so
`hide()` correctly cleans up its mask every time. `destination-detail`/`weather`/`hotels`/
`connections` were never at risk (their `[modal]` only depends on `breakpoint.isDesktopSplitView()`,
which doesn't change at close time) and are unchanged.

## References

- @context/features/desktop-redesign-phase0-foundations-spec.md
- @context/features/desktop-responsive-redesign-spec.md (master plan)
- @context/features/trip-planner-activities-spec.md (the `mode: 'select'` reuse this phase had to
  avoid breaking)
- @frontend/src/app/shared/drawer-host/drawer-host.html, drawer-host.ts, drawer-host.css
- @frontend/src/app/shell/destinations-layout/destinations-layout.ts
