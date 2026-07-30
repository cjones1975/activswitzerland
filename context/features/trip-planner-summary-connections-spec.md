# Trip Planner Summary — Inline Rail Connections + Map Gating

**Status: spec only, not yet branched/implemented.**

## Overview

Rail-connection setup (Step 2's "Train Connections" drawer) is easy to miss on mobile — it sits
below a scroll, and having every leg resolved is what makes the Summary map preview meaningful
(unresolved legs currently just draw a straight line between stops in `buildRailRoute()`). The
user considered two fixes and picked this one (their words: *"Number 2 is my preferred option"*):

- ~~Option 1: force-resolve every rail leg on Step 2 before Step 3 is reachable, removing "Skip for
  now" entirely~~ — **not chosen**.
- **Option 2 (this spec)**: leave Step 2 exactly as it is (including "Skip for now" — it stays).
  Instead, Summary's timeline gets a connection item between every pair of stops for rail trips —
  resolved, skipped, or never-touched — clickable to open the existing `'connections'` drawer.
  The Map View toggle is blocked (with a warning toast) until every leg has a real picked
  connection; skipped legs still block it, matching the existing `routeComplete`/`unresolvedLegs`
  semantics already in `step4-summary.ts` (which only counts a leg resolved if it has `.connection`,
  not just an entry).

Two structural changes fall out of this:

1. **Summary's timeline must include every stop, not just `days > 0` ones.** Rail legs
   (`TripPlannerService.legPairs()`) are built off the *full* consecutive stop list, including
   0-day "pass-through" stops (e.g. a same-day transfer). Today's `visibleStops()` filter hides
   those entirely, which would leave a leg with nowhere correct to attach in the timeline.
   **Confirmed via AskUserQuestion**: 0-day stops get a slim marker card instead of being hidden,
   so both of their real legs (in, out) render at their correct position. This falls out for free
   once the main `@for` iterates `trip().stops` directly instead of `visibleStops()` — a 0-day stop
   naturally has no assignable day, so `hasActivities()` is always false for it and its card
   renders with no activities section, which *is* the "slim marker" (no new markup path needed).
2. **The shared `'connections'` drawer needs to auto-expand one specific leg** when opened from a
   Summary timeline click (today it always opens with every leg collapsed — fine for Step 2's
   generic "Train Connections" button, not fine for "I just clicked on the Geneva → Bern leg
   specifically").

## Confirmed decisions

- **Step 2 unchanged.** Its "Train Connections" button/badge, the `ConnectionsDrawer`/
  `ConnectionLegPicker` components, and "Skip for now" all stay exactly as they are. This feature
  only adds a new entry point (Summary timeline clicks) and a new optional auto-expand behavior to
  the same shared drawer — nothing about Step 2's own flow changes.
- **Timeline layout**: `step4-summary.html`'s main `@for` switches from `visibleStops()` to the
  full `trip().stops` (order preserved — legs are always between literally-consecutive stops).
  After each stop's card except the last (rail trips only), a new connection item renders for that
  `(stops[i], stops[i+1])` pair, sourced from `plannerSvc.legPairs()`/`getConnectionLeg()` (the same
  data Step 2/the drawer already use).
- **Connection item states** (all three clickable, all open the `'connections'` drawer):
  - **Resolved** (`leg.connection` present): departure→arrival time, duration, transfer count,
    train icon — a condensed one-line version of `ConnectionLegPicker`'s existing `.leg-picked`
    summary, not the full expandable card (Summary is a review surface; editing happens in the
    drawer it opens).
  - **Skipped** (`leg.skipped`): "Connection skipped" (reuses the existing
    `trip.planner.step2.connectionSkipped` i18n key — no new key needed, it's a generic phrase) +
    a neutral icon, still clickable to pick one.
  - **Unresolved** (no leg entry at all): "Connection needed" (reuses
    `trip.planner.step2.connectionNeeded`), warning styling (same amber `.s4-connection-banner`
    palette already in `step4-summary.css`, repurposed into the new inline item instead of a
    separate bottom-of-page banner).
- **Auto-expand on click**: clicking any connection item calls
  `drawerSvc.open('connections', { focusLeg: '${from.id}:${to.id}' })`. `ConnectionsDrawer` reads
  `drawerSvc.getPayload<{ focusLeg?: string }>('connections')` and passes
  `[autoExpand]="pair.from.id + ':' + pair.to.id === payload?.focusLeg"` to each
  `ConnectionLegPicker`; a new `@Input() autoExpand = false` there drives its existing `expanded`
  signal. Opening the drawer from Step 2's plain "Train Connections" button (no payload) leaves
  every leg collapsed, exactly as today.
- **Map View gating**: `showMap()` checks `type() === 'rail' && !routeComplete()` (the existing
  computed — already means "every leg has a real `.connection`", skipped or missing both count as
  incomplete) and, if blocked, calls
  `toast.warn(translate.instant('trip.planner.step4.mapRequiresConnections'))` and returns instead
  of calling `hideWizard()`. Road trips are never gated (`routeComplete()` is vacuously true when
  there are no rail legs). The Map View button itself stays enabled either way — a disabled button
  can't explain *why* via a toast, and the requirement explicitly wants the user to get a warning
  on the attempt, not have the option silently unavailable.
- **Removed**: the old bottom-of-page `unresolvedLegs()` `@for` loop and its "Fix connection"
  button (superseded by the inline per-leg items, which cover every leg — resolved, skipped, and
  unresolved — not just unresolved ones). The `unresolvedLegs` computed itself stays (still feeds
  `routeComplete`). The "Route complete!" banner (`s4-complete-banner`) is unaffected — still shows
  once every leg is genuinely resolved.

## Frontend

### `frontend/src/app/features/trip-planner/step4-summary/step4-summary.ts`

- Main stop loop switches from `visibleStops()` to `trip().stops` directly (keep `visibleStops` only
  if still needed elsewhere — currently it isn't, so it can be removed rather than left dead).
- New `legFor(fromStop, toStop): TripConnectionLeg | undefined` — thin wrapper over
  `plannerSvc.getConnectionLeg()` for template use.
- New `openConnection(fromStop, toStop): void` — `drawerSvc.open('connections', { focusLeg:
  `${fromStop.id}:${toStop.id}` })`.
- `showMap()` gains the gating check + `toast.warn(...)` above; needs `Toast` (`core/services/toast`)
  and `TranslateService` injected (translate.instant, matching `step5-save.ts`'s existing pattern for
  toast copy).
- Remove `fixConnection()` (superseded by `openConnection()`).

### `frontend/src/app/features/trip-planner/step4-summary/step4-summary.html`

- Main `@for` over all stops; each stop card unchanged internally. Between consecutive stops
  (`i < stops.length - 1`), for rail trips only, render the new connection item keyed off
  `legFor(stops[i], stops[i+1])`, `(click)="openConnection(stops[i], stops[i+1])"`.
- Delete the old `@if (type() === 'rail') { @for (leg of unresolvedLegs()...) }` banner block.
- `s4-complete-banner` block unchanged.

### `frontend/src/app/features/trip-planner/step4-summary/step4-summary.css`

- New `.s4-conn-item` (+ state modifiers `--resolved`/`--skipped`/`--needed`) replacing
  `.s4-connection-banner`/`.s4-fix-connection` (deleted — no longer used). Resolved state reuses the
  navy/gray palette already in this file; skipped/needed reuse the existing amber warning palette.
  Positioned as its own row between `.s4-stop-card`s (small vertical connector line, matching the
  numbered-circle timeline motif already used for stop indices).

### `frontend/src/app/features/trip-planner/connections-drawer/connections-drawer.ts`/`.html`

- `ConnectionsDrawer` reads `drawerSvc.getPayload<{ focusLeg?: string }>('connections')` and passes
  the computed `autoExpand` boolean per pair (per above) to each `<app-connection-leg-picker>`.

### `frontend/src/app/features/trip-planner/step2-itinerary/connection-leg-picker/connection-leg-picker.ts`

- New `@Input() autoExpand = false`. Needs to actually react if the drawer's underlying DOM/component
  instance is reused across opens rather than recreated (PrimeNG `p-drawer` visibility toggling
  doesn't necessarily destroy/recreate content) — verify live whether a plain `ngOnInit`
  one-time `this.expanded.set(this.autoExpand)` is enough, or whether an `ngOnChanges`/`effect()`
  reacting to input changes is needed so re-opening the drawer for a *different* leg re-collapses
  the previous one and expands the new one correctly.

## i18n

- New: `trip.planner.step4.mapRequiresConnections` ("Train connections are required to view the
  map") — added across en/de/fr/it.
- No other new keys — connection-item state labels reuse the existing
  `trip.planner.step2.connectionPicked`/`connectionSkipped`/`connectionNeeded` keys (generic
  phrases, not Step-2-specific wording).

## Open questions / needs live verification

- Whether `ConnectionsDrawer`'s content is destroyed/recreated by PrimeNG's `p-drawer` each time it
  opens, or kept alive in the DOM — determines whether `autoExpand` needs to be a one-shot
  `ngOnInit` read or a reactive `ngOnChanges`/`effect()`. Needs checking in a live browser session
  (no browser-automation tool in this environment) or by reading PrimeNG v21's `Drawer` source.
- Whether a 0-day stop's slim card should still show its role badge (`Departure`/`Via`/`Destination`)
  — the spec assumes yes (falls out for free, unchanged), flagging only in case that reads oddly for
  a same-day pass-through labeled "Via".
- Visual spacing/sizing of the new connector row between `.s4-stop-card`s — a design judgment call
  best made once it's actually on screen, not fully nailed down in this spec.

## References

- @frontend/src/app/features/trip-planner/step4-summary/step4-summary.ts
- @frontend/src/app/features/trip-planner/step4-summary/step4-summary.html
- @frontend/src/app/features/trip-planner/step4-summary/step4-summary.css
- @frontend/src/app/features/trip-planner/connections-drawer/connections-drawer.ts
- @frontend/src/app/features/trip-planner/connections-drawer/connections-drawer.html
- @frontend/src/app/features/trip-planner/step2-itinerary/connection-leg-picker/connection-leg-picker.ts
- @frontend/src/app/features/trip-planner/step2-itinerary/connection-leg-picker/connection-leg-picker.html
- @frontend/src/app/shared/services/trip-planner.ts (`legPairs`/`getConnectionLeg`/`setConnectionLeg`/`skipConnectionLeg`)
- @frontend/src/app/shared/services/drawer.ts (`open(key, payload?)`/`getPayload<T>(key)`)
- @frontend/src/app/core/services/toast.ts
