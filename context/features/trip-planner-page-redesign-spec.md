# Trip Planner: Page Redesign + Connections Drawer

## Context

After live review of the rebuilt Trip Planner (see `context/features/trip-planner-rebuild-spec.md` for the base 5-phase rebuild this iterates on), three problems surfaced:

1. The wizard (`app-trip-planner-wizard`) only ever renders inside a PrimeNG `p-drawer` (`DrawerKey: 'trip-planner'`). PrimeNG drawers are `modal: true` by default, so every time it opens: a full-viewport dark scrim covers the header/footer chrome, there's a slide-in animation, and the underlying map briefly renders before the drawer animates over it. The ask: when reached from the homepage hero, nav-menu, or footer-menu, the user should land directly on the wizard as the page itself — no overlay, no scrim, no flash.
2. Visual design should move toward `context/screenshots/trip_planner_redesign.png`. Per [[feedback_mockups_are_journey_not_design]], this is a structural/journey reference (step flow, card layout, chrome), not a pixel spec.
3. Step 1 "My Trip"'s Start Date / End Date inputs are stacked vertically; they should sit side by side on the same row.
4. Step 2 "Itinerary"'s rail-connection pickers should move out of the inline step content and into their own drawer, opened via a "Train Connections" button. Confirmed with user: this button/drawer only appears for **Rail Journey** trips, not Road Trip.

## Current architecture (as found)

- `/trip-planner` and `/trip-planner/:id` route to `TripPlannerLayout` (`frontend/src/app/shell/trip-planner-layout/`), a fixed full-viewport map shell. Its `ngOnInit` immediately calls `Drawer.open('trip-planner', payload?)` — the wizard has **no route of its own** today; it exists only as a `<p-drawer>` body inside `DrawerHost` (`frontend/src/app/shared/drawer-host/`).
- `Drawer` service (`frontend/src/app/shared/services/drawer.ts`) tracks an open-drawer `stack`, a `collapsedKeys` set, and a `payloads` map, keyed by a `DrawerKey` union. `isOpen(key)` only checks `stack`; `collapse(key)` removes from `stack` but keeps the payload (vs. `close(key)`, which discards it) — this is exactly what Step 4 Summary's "Map View" toggle uses (`drawer.collapse('trip-planner')`) to hide the wizard and reveal the map/route/activity markers underneath, while keeping wizard state alive for reopening.
- `TripPlannerLayout`'s `displayedTripRoute` / `displayedTripActivityMarkers` / `displayedTripStopPoints` / `tripBounds` computeds all gate on `!drawer.isOpen('trip-planner')` — i.e. the map only shows the route/markers once the wizard drawer is hidden.
- Destination-prefill (`/trip-planner/:id`): `TripPlannerLayout` resolves the destination and calls `drawer.open('trip-planner', payload)`; `TripPlannerWizard` has an effect watching `drawer.getPayload('trip-planner')` to seed Step 1/2's destination stop.
- Entry points (`menu-nav.html`, `footer-nav.html`, `home.ts`'s hero CTA) all just `router.navigate(['/trip-planner'], { queryParams: { from: router.url } })` — none call `Drawer` directly. The `from` param is read by `drawer-host.ts`'s `onTripPlannerBack()` to know where the back-chevron should return to.
- Step 2's rail connections: `step2-itinerary.html` renders one `<app-connection-leg-picker [fromStop] [toStop] (resolved)>` per consecutive stop pair (`legPairs()`, computed locally in `step2-itinerary.ts`), inline at the bottom of the same scroll container as the stop list, only `@if (type() === 'rail')`. `ConnectionLegPicker` is fully self-contained and parameterized by its two inputs — trivially relocatable. `step4-summary.ts` independently recomputes the same consecutive-pair logic as `unresolvedLegs()` to drive a "connection needed" banner whose "Fix connection" button currently does `plannerSvc.step.set(2)`.

## Target architecture

### Part A — Wizard becomes direct page content, not a drawer

**`TripPlannerService`** (`frontend/src/app/shared/services/trip-planner.ts`) gains:
- `wizardVisible = signal(true)` + `showWizard()` / `hideWizard()` — replaces `Drawer.isOpen/open/collapse('trip-planner')` for this one purpose. `reset()` also resets this back to `true`.
- `prefillPayload` signal + a setter — replaces reading `Drawer.getPayload('trip-planner')`.
- A hoisted `legPairs()` computed (consecutive stop pairs from `snapshot.stops`) — dedupes the logic currently copy-pasted in `step2-itinerary.ts` (`legPairs`) and `step4-summary.ts` (`unresolvedLegs`), and is also needed by the new connections-drawer component (Part B).

**`TripPlannerLayout`** (`frontend/src/app/shell/trip-planner-layout/*`):
- Drop the `Drawer` injection and every `drawer.isOpen/open/close('trip-planner', ...)` call.
- `displayedTripRoute`/`displayedTripActivityMarkers`/`displayedTripStopPoints`/`tripBounds` gate on `!tripPlanner.wizardVisible()`.
- Destination-prefill calls `tripPlanner.setPrefillPayload(...)` instead of `drawer.open('trip-planner', payload)`.
- `reopenTripPlanner()` → `tripPlanner.showWizard()`; the `reopen-btns` visibility gate switches to `!tripPlanner.wizardVisible()`.
- Template renders `<app-trip-planner-wizard>` directly (`@if (tripPlanner.wizardVisible())`), positioned in a wrapper above the map (z-index above the map's 101, below header-nav's 200 / footer-nav's 150), with top/bottom insets matching the real header/footer heights — so header and footer nav remain visible and interactive, exactly matching the mockup (app header + wizard body + footer nav, no map, no scrim).

**`TripPlannerWizard`** (`frontend/src/app/features/trip-planner/trip-planner-wizard/*`):
- Replace the `Drawer`-payload-driven prefill computed with one reading `tripPlanner.prefillPayload()`.
- Add `goBack()` (ported from `drawer-host.ts`'s `onTripPlannerBack()`): if a `from` query param is present, navigate there; otherwise fall back to `/`. Wire to a back-chevron in the wizard's own header, replacing the chevron that used to live in the drawer's `<ng-template #header>`.

**`Step4Summary`**: `showMap()` → `tripPlanner.hideWizard()`.

**`Drawer` service**: remove `'trip-planner'` from `DrawerKey`.

**`DrawerHost`**: delete the `<!-- TRIP PLANNER -->` `<p-drawer>` block and `onTripPlannerBack()`.

No changes to `app.routes.ts`, `menu-nav.html`, `footer-nav.html`, or `home.ts` — they already just navigate to `/trip-planner`/`/trip-planner/:id`, unaffected by how that destination renders. `footer-nav.ts` already allow-lists `/trip-planner(/.*)?`.

### Part B — Train Connections drawer

- `Drawer`: add `'connections'` to `DrawerKey`.
- New component `frontend/src/app/features/trip-planner/connections-drawer/connections-drawer.{ts,html,css}`: `@for (pair of plannerSvc.legPairs(); ...) { <app-connection-leg-picker [fromStop]="pair.from" [toStop]="pair.to" (resolved)="..." /> }` — the same block moved wholesale out of `step2-itinerary.html`. No changes needed to `ConnectionLegPicker` itself.
- `DrawerHost`: add a `<p-drawer>` block for `'connections'` (same modal/width pattern as other secondary drawers, e.g. `hikes`/`bikes`), hosting `<app-connections-drawer>`.
- `step2-itinerary`: remove the inline rail-connections block and its local `legPairs`; add a "Train Connections" button, `@if (type() === 'rail')`, calling `drawer.open('connections')` (consider a badge for unresolved-leg count).
- `step4-summary.ts`: `fixConnection()` calls `drawer.open('connections')` directly instead of `plannerSvc.step.set(2)` — no longer tied to being on step 2.
- i18n: new key (e.g. `trip.planner.trainConnections`) added to `en.json` and mirrored into `de.json`/`fr.json`/`it.json` in the same pass, per [[feedback_i18n_translate_all_locales]].

### Part C — Step 1 date fields side by side

- `step1-my-trip.html`: wrap the Start Date / End Date `.s1-field` blocks (in the `dateMode() === 'dates'` branch) in a new row container.
- `step1-my-trip.css`: `.s1-date-row { display: flex; gap: 0.6rem }`, each `.s1-field { flex: 1; min-width: 0 }`. Days-mode field untouched.

### Part D — Visual pass toward the mockup

Current Step 1 already structurally matches the mockup (2-col grid cards for trip-type/date-mode, radio-dot selected state, sticky full-width footer button, numbered step-indicator with connecting lines). Do a lighter CSS pass on `step1-my-trip.css` and `trip-planner-wizard.css` to align card icon styling (dark rounded-square icon backgrounds), selected-card border/tint, and footer button style (chevron icon) — not a rebuild.

## Verification

- `ng serve`; click through homepage hero CTA, nav-menu, and footer-menu entries into `/trip-planner` — confirm no drawer scrim/flash, wizard renders as the page with header/footer chrome intact.
- Step 1: Start/End Date sit side by side; trip-type/date-mode cards and Continue button still work.
- Step 2: "Train Connections" button appears only for Rail Journey, opens the connections drawer with all legs; pick/skip still writes to `TripPlannerService` correctly; itinerary route rebuilds.
- Step 4: "Map View" still hides the wizard and reveals the route/markers on the map; floating reopen button brings the wizard back.
- Destination-prefill via `/trip-planner/:id` still seeds Step 1/2's destination stop.
- Back-chevron (`from` query param case) still returns to the originating page.
