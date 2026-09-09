# Mobile Drawers: Bottom Sheet Instead of Full-Screen Left Slide

## Overview

Today, on mobile (`<768px`, the existing full-width breakpoint in `drawer-host.css`), the
destination/activity/hike/bike drawers are `position="left"` `p-drawer`s that slide in edge-to-edge,
fully covering the map underneath. This spec replaces that with a fixed-height bottom sheet (~75% of
viewport height) that leaves the map visible above it at all times — the pattern used by Google Maps,
Apple Maps, Citymapper, Airbnb, etc. Drag-to-resize was discussed and explicitly **descoped** by the
user for this pass (noted as a possible later fast-follow, not part of this spec).

Desktop (`≥1280px`, the existing split-view docked sidebar) is entirely unaffected — this only changes
the sub-768px tier's own presentation.

## Scope

The seven drawers the user named — destination, activity, hike, bike:

- `destination-detail`
- `all-attractions`, `attraction-detail`
- `hikes`, `hike-detail`
- `bikes`, `bike-detail`

**Explicitly not in scope, flagged for a follow-up decision**: `weather`, `hotels`, `connections`.
These weren't named, and `connections` in particular is opened *from inside* the trip-planner wizard
(no map behind it worth exposing) — worth deciding separately rather than assumed into this pass.

## Confirmed decisions

- **Height**: fixed at 75% of viewport height (no drag-to-resize). Rounded top corners
  (`border-radius: 16px 16px 0 0`), matching the bottom-sheet convention.
- **Map icon removed entirely**: the separate `fa-map-location` "show on map" button (currently
  collapses the drawer via `onCollapse(key)`/`onXViewOnMap()`) is deleted from all seven headers —
  redundant once the map is already partially visible at all times.
- **`Drawer.collapse()` itself is not touched**: it's still used elsewhere at desktop split-view width
  (`showHikeMarkers`/`showBikeMarkers` in `destinations-layout.ts` check `isCollapsed()` for marker
  visibility). This spec just stops *calling* collapse for these seven drawers on mobile; the
  mechanism stays intact for desktop's unrelated use of it.
- **Reopening via the map's existing pill buttons, no new visibility logic needed**: `.reopen-btns`
  already show/hide based on `!drawer.isOpen(key)` (plus a since-irrelevant `isCollapsed(key)` check
  that will just always be `false` for these seven going forward, harmlessly). Since a fully-closed
  drawer already satisfies `!isOpen(key)`, the existing pills start reappearing automatically the
  moment these drawers close — no changes needed there.

## Confirmed decision: what the X actually does

Superseded after live review: Option B (X reuses each drawer's existing smart "back" method) was
built first, but the user found the resulting chain-reopen behavior unintuitive on mobile — closing
`attraction-detail`, say, landing back on `all-attractions` rather than the bare map wasn't what a
user would expect from an X. **Final behavior: X always calls a plain `onDrawerClose(key)` for all
seven drawers, full stop — no reopening a parent, no navigating away.** Reopening anything happens
only via the map's reopen pills, exactly as originally described in the initial ask. The options
below are kept for the record of what was tried and why it changed.

This is the one place the user's framing ("replace the chevron with an X, reopen via the map icons")
doesn't map cleanly onto the current code, and resolving it wrong would undo real work from earlier
this session. Worth confirming before implementation starts.

**What exists today, concretely**: each of these drawers currently has *two* separate header icons,
not one — a chevron (`onXBack()`) and a separate map-icon (`onCollapse`/`onXViewOnMap`, being removed
per the decision above). The chevron's behavior varies by drawer and by how it was opened:

- `all-attractions`/`hikes`/`bikes` (list drawers, no parent): chevron closes back to `destination-detail`
  (or, in trip-planner `select` mode, back to the wizard).
- `attraction-detail`/`hike-detail`/`bike-detail` (detail drawers): chevron's target depends on
  `source` — back to `all-attractions`/`hikes`/`bikes`, or to `destination-detail`, or navigates away
  entirely to `/search`/`/explore-trips`, or (just fixed this session) correctly follows the original
  entry point even after hopping between attractions via map-tooltip clicks.

**Option A — X always just closes, full stop.** Every one of the seven drawers gets a plain X wired to
`drawer.close(key)` and nothing else. Simplest, matches the literal request. But it throws away the
"return to exactly where you came from" chain built this session for the detail drawers — closing
`attraction-detail` would drop straight to the bare (75%-covered) map, and the user would have to
manually tap a reopen pill to get back to `all-attractions` or `destination-detail`, rather than
landing there automatically. Also loses the away-navigation for `/search`/`/explore-trips` sources —
those would need their own separate handling if this option is picked.

**Option B — X keeps the existing smart chevron logic where one exists, matching the concept "X closes
in the way appropriate for how this can be closed" (recommended).** For the three *detail* drawers,
the X calls the exact same `onAttractionDetailBack()`/`onHikeDetailBack()`/`onBikeDetailBack()` logic
that exists today (already correct, including this session's map-tooltip fix) — it just looks like an
X instead of a chevron, no behavior change. For the four *list*/root drawers (`destination-detail`,
`all-attractions`, `hikes`, `bikes` when not opened from the wizard), the X does a plain
`drawer.close(key)`, since those already close-to-map today (their "back" already isn't a rich chain
to preserve — `all-attractions`'s own chevron already just reopens `destination-detail`, which is
one level, not a chain). Net effect: nothing about *where clicking X takes you* changes from today's
chevron behavior, only the icon and the map-icon's removal.

I'd go with **Option B** — it's not meaningfully more work (same methods, new icon, delete the
map-icon button), and Option A would make attraction/hike/bike detail navigation *worse* than it is
today for no real gain.

## Confirmed decision: the visible map slice is interactive while a sheet is open

User confirmed **non-modal** below.

Today these drawers are modal (`[modal]="true"`, scrim, no interaction with what's behind) below the
split-view breakpoint. Two options:

- **Non-modal (recommended)**: the visible ~25% map strip stays fully interactive — pan/zoom, and
  since MapLibre markers are just positioned DOM elements, any marker visible in that strip is already
  tappable with no extra work, mirroring the desktop split-view philosophy ("map should always feel
  central and interactive").
- **Modal**: matches today's exact behavior otherwise (dismiss-on-scrim-tap could double as a close
  gesture), simpler mental model, but makes the visible map slice purely decorative.

Recommend non-modal, consistent with the split-view precedent, but flagging since it's a real behavior
change (map becomes tappable on mobile in a way it isn't today while a drawer is open).

## Implementation sketch (once the above are settled)

- New `Breakpoint` constant/signal, e.g. `isMobile` at `<768px` — matching the value already
  hardcoded in `drawer-host.css`'s existing full-width media query, not a new/different number.
- `drawer-host.html`: for the seven drawers, `[position]` becomes conditional
  (`breakpoint.isMobile() ? 'bottom' : 'left'`), height set to `75vh` only in the mobile case
  (desktop's own width/docking rules untouched).
- Remove the `fa-map-location` buttons from all seven `#header` templates; replace each remaining
  chevron button with a plain `pi-times` icon, same click handler as today per the Option B decision
  above.
- `drawer-host.css`: rounded top corners for the mobile-bottom-sheet state; confirm `overflow-y: auto`
  (already present via `.dest-drawer .p-drawer-content`) correctly scrolls the now-shorter content
  area.
- No changes to `Drawer` service, `destinations-layout.ts`'s marker-visibility computeds, or anything
  desktop-specific.

## References

- @frontend/src/app/shared/drawer-host/drawer-host.html, drawer-host.css, drawer-host.ts
- @frontend/src/app/shell/destinations-layout/destinations-layout.ts (`onMarkerClick`, reopen-btns,
  `showHikeMarkers`/`showBikeMarkers`)
- @frontend/src/app/shared/services/breakpoint.ts
- @frontend/src/app/features/explore-trips/explore-trips-filter/ (existing `position="bottom"`
  precedent in this codebase)

## Status

**Implemented.** Branch `feature/mobile-drawer-bottom-sheet` (created off the current, still-uncommitted
`desktop-redesign` working state — that branch's own desktop-only changes are unrelated to this spec
and should be committed/handled separately on `desktop-redesign` itself).

- `breakpoint.ts`: new `MOBILE_MAX_WIDTH = 768` constant + `isMobile` signal.
- `drawer-host.ts`: `stickyModal()` now also treats mobile as non-modal (trip-planner mode still
  always modal, at every width). New `xMobileSheet` computed per drawer (`isMobile() &&
  !isXTripPlanner()`) gates the new behavior off entirely for trip-planner/search/explore-trips/
  trip-summary sources, which keep today's full-screen modal unchanged at every width.
  `onAllAttractionsBack()` (still used by the tablet-width chevron) is back to its original,
  unconditional `collapse()` — the mobile-only branch that used to live there was removed once X
  stopped calling this method at all.
- `drawer-host.html`: all seven drawers get a `@if (xMobileSheet())` branch — `position="bottom"`,
  `height: 75vh`, a single X wired to `onDrawerClose(key)` (plain close, identical for all seven, no
  exceptions). The `@else` branch is every one of these drawers' *exact existing header* — chevron,
  smart back-navigation, the "show on map" icon — completely unchanged, still used for tablet width
  and trip-planner mode.
- `drawer-host.css`: rounded top corners on the sheet state; `.dest-header--sheet` right-aligns the
  lone X.

**Fast-follow, added after live review**: an expand/collapse caret (`fa-square-caret-up`/`-down`),
left of the X on the same row. Toggles the sheet between the default `75vh` and full `100vh` — a
discrete two-state toggle, not the continuous drag-to-resize that was explicitly descoped earlier.
One shared `sheetExpanded` signal on `DrawerHost` (these seven drawers are mutually exclusive, so no
need for one per drawer), reset to `false` inside `onDrawerClose()` so the next drawer opened always
starts at the default height rather than inheriting the previous one's expansion state. `nav.expand`/
`nav.collapse` added to all 5 locales for the button's aria-label. A `transition: height 0.2s ease`
was added to the sheet so the toggle animates smoothly rather than jumping.

Build clean (`ng build`); not yet verified live in-browser.
