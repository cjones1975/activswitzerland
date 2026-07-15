# Trip Planner — Step 4 (Summary)

## Why

Phase 3 of the trip planner rebuild (see `trip-planner-rebuild-spec.md`'s Phase 3 pointer
section). Step 4 gives the user a read-only overview of the whole trip they just built in
Steps 1-3 — a timeline of stops with their assigned activities, a way to see the same thing
on the map, and a heads-up for any rail leg that still needs a connection picked before they
can Save. The wizard shell already reserves this step (`STEP_KEYS` includes `'summary'`,
`trip-planner-wizard.html`'s `@switch` just falls through to the placeholder for `@case (4)`
today). Mockup: `context/screenshots/TripPlanner6 -Summary.png` (journey/shape reference
only, not a pixel spec — see the master spec's note on mockups).

## Confirmed decisions

- **No photos/thumbnails.** Timeline entries and map popups show a kind icon (binoculars /
  hiking / bike, reusing `step3-activities`' `CATEGORIES` icon set) + name + day — for all
  three activity kinds, including attractions (which do have a real `Attraction.photo`).
  Chosen over adding image plumbing since hikes/bikes have no real photo source at all
  (Phase 0 confirmed cards use a generated route-shape drawing, not a photo) and mixing
  "real photo for one kind, icon for the other two" was judged inconsistent for the added
  complexity. Zero changes to `TripActivitySelection`.
- **"Map View" reuses the existing drawer-collapse mechanism**, not a second embedded map —
  per the master spec's Phase 3 note. `trip-planner-layout.ts` already hides/shows the trip
  route and stop markers based on `Drawer.isOpen('trip-planner')`
  (`displayedTripRoute`/`displayedTripStopPoints`, lines 62-74) and already renders a
  "reopen trip planner" button when collapsed (`trip-planner-layout.html:19-24`). Step 4's
  "Map View" button calls `drawer.collapse('trip-planner')`; the existing reopen button
  brings the user back to the drawer (and therefore back to whichever step they were on,
  i.e. Summary, since `plannerSvc.step` is untouched by collapse/open).
- Unresolved rail connection legs (skipped in Step 2, or never attempted) get an
  informational banner per leg with a "Fix connection" action that jumps back into Step 2 —
  never blocking. Step 2's `ConnectionLegPicker` is already rendered inline for every
  `legPairs()` entry simultaneously (not a modal/per-leg drawer), so the jump-back is just
  `plannerSvc.step.set(2)` — no new state needed to point Step 2 at a specific leg; the
  unresolved picker(s) are already visible on that step.
- Stat tiles: "Destinations" = `trip.stops.length` (all stops, matching the mockup's "2" for
  a 2-stop Geneva→Zürich trip), "Activities" = `trip.activities.length`.
- Type/date badges: `typeRoad`/`typeRail` badge (reusing existing `trip.planner.typeRoad` /
  `typeRail` keys) + a date badge — `formatDdMmYyyy(start) — formatDdMmYyyy(end)` in `dates`
  mode, `"N days"` in `days` mode (no concrete dates to show).
- Timeline shows every stop with `days > 0` (mirrors `Step3Activities.visibleStops`), in
  order, each with its day range (`stopDayRanges()`) and its added activities grouped by
  kind, each with an inline remove (×) control — matching Step 3's "removable from
  everywhere" decision. Stops with `days === 0` are omitted from the timeline (nothing to
  show — no day, and Step 3 never let activities be added to them).

## Map changes (`shared/map/map.ts`)

Per the master spec: replace today's distinct start/end icon scheme (green circle-dot /
red location-dot, `syncTripRoute()` lines ~307-332) with **every stop numbered by visit
order** (departure = 1, through destination = N), all sharing the existing via-stop numbered
style (`#285278` navy circle), except the **final stop (destination) gets a distinct color**
(e.g. red, matching the mockup) so it's visually distinguishable at a glance regardless of
how many stops the trip has. This only touches the `road` branch — the `rail` branch (a dot
per route-line vertex, not per discrete stop) is a separate, untouched concern.

## Activity markers (`shell/trip-planner-layout/`)

`tripAttractionMarkers` (trip-planner-layout.ts:41-54) already exists as Phase 1 scaffolding
— its doc comment says "always empty this phase" but Phase 2 shipped and populated
`trip.activities`, so it's live today, just attraction-only and unclicked (`markerClick` is
never bound on `<app-map>` in `trip-planner-layout.html`). Phase 3:

- Rename to `tripActivityMarkers`, widen the `kind === 'attraction'` filter to include all
  three kinds, and vary `icon`/`color`/`className` by kind (binoculars/navy, hiking/green,
  bicycle/orange — matching `step3-activities`' category icons).
- Change `id: a.refId` → `id: a.id` (the `TripActivitySelection`'s own generated uuid).
  `refId` can collide across kinds/stops (different external ID namespaces); the
  selection's own id is guaranteed unique and lets a click handler find the full selection
  object directly via `trip().activities.find(x => x.id === marker.id)` — no need to encode
  kind into the marker id string.
- Bind `(markerClick)="onActivityMarkerClick($event)"` on `<app-map>`
  (`trip-planner-layout.html:2-9`, currently unbound).
- `onActivityMarkerClick(marker)`: look up the `TripActivitySelection` by `marker.id`, then
  open the matching detail drawer:
  - **attraction**: `attractionsSvc.getAttraction(activity.refId, lang)` (already exists,
    direct fetch-by-id) → `drawerSvc.open('attraction-detail', { attraction, destination,
    source: 'trip-summary' })`.
  - **hike/bike**: no fetch-by-id exists for trail routes (`TrailRoutesService.getRoutes()`
    is radius-search-only). Re-fetch via the owning stop's coordinates —
    `trip().stops.find(s => s.id === activity.stopId)` gives the anchor `lat`/`lon` already
    used when the picker was first opened — then `getRoutes(kind, stop.lat, stop.lon, lang)`
    and `.find(r => r.id === activity.refId)` in the results. Best-effort: if the route isn't
    found in that radius anymore (rare), no-op rather than adding new error-state UI.
  - `destination` passed to all three detail payloads is a `GeoPoint` built from the owning
    stop (`{ id: stop.id, name: stop.name, lat: stop.lat, lon: stop.lon }`), same shape
    Step 3's `openPicker()` already constructs.

## Back-nav: new `source: 'trip-summary'` (attraction-detail) / equivalent for hike/bike

`onAttractionDetailBack()` (`shared/drawer-host/drawer-host.ts:77-85`) always reopens
`all-attractions` unless `source === 'destination-detail'`. A detail drawer opened from a
Summary map marker click has no backing list drawer on the stack (the trip-planner drawer is
*collapsed*, not open, while the map is visible) — reopening `all-attractions` would be
wrong. Add a third `source: 'trip-summary'` value:
```ts
if (payload.source === 'trip-summary') { this.svc.open('trip-planner'); return; }
```
`this.svc.open('trip-planner')` un-collapses the drawer, returning the user to whichever
step they were on (Summary, since `plannerSvc.step` is untouched by collapse).

`HikeDetailPayload`/`BikeDetailPayload` (`features/hikes/hike-detail/hike-detail.ts:17-22`,
`features/bikes/bike-detail/bike-detail.ts:17-22`) currently have no `source` field at all —
`onHikeDetailBack()`/`onBikeDetailBack()` unconditionally reopen `hikes`/`bikes`. Add
`source?: 'hikes' | 'trip-summary'` / `source?: 'bikes' | 'trip-summary'` to each payload
(default behavior unchanged when omitted) and branch both back-nav handlers the same way as
attraction-detail above.

## `features/trip-planner/step4-summary/` (new)

- `trip = toSignal(plannerSvc.trip$, ...)`, same pattern as Step 3.
- `visibleStops = computed(() => trip().stops.filter(s => s.days > 0))`,
  `stopDayLabels = computed(() => stopDayRanges(trip().stops))` — reused from Step 3.
- Stat tiles: destinations count, activities count (see Confirmed decisions).
- Type badge + date badge (see Confirmed decisions).
- Timeline / Map View toggle (two buttons, not a routed tab): "Timeline" is a no-op (it's
  the default view — the component itself only ever renders the timeline); "Map View" calls
  `drawer.collapse('trip-planner')`. No local view-mode state needed since collapsing
  literally removes this component from the DOM (drawer stack) until reopened.
- Per visible stop: header (pin icon + name + role badge via `trip.planner.step2.<role>`,
  matching `step3-activities.html`'s `.s3-stop-head` pattern) + day range label, then its
  added activities grouped by kind (icon + name + day + remove ×), reusing
  `plannerSvc.getActivitiesForStop(stop.id)` / `removeActivity(activity.id)` exactly as
  Step 3 does.
- Unresolved connection banners: for a `rail` trip, iterate consecutive stop pairs
  (mirrors `Step2Itinerary.legPairs()`) and flag any pair where
  `plannerSvc.getConnectionLeg(from.id, to.id)?.connection` is falsy (never set, or
  explicitly skipped) — render an info banner ("Connection needed: {{from}} → {{to}}") with
  a "Fix connection" button calling `plannerSvc.step.set(2)`. Road trips never show this
  section (no `connections` to resolve).
- "Route complete" success banner (per mockup) when the trip is `rail` and every leg has a
  resolved connection, or when the trip is `road` (roads never need a connection, so a road
  trip is always "complete" once it has ≥2 stops).
- Footer: Back / Continue-to-Save (`plannerSvc.prevStep()` / `plannerSvc.nextStep()`),
  mirroring `step3-activities.html`'s footer exactly (same `p-button` severity/icon
  conventions). Continue is never blocked — unresolved connections are informational only,
  per the master spec.

`trip-planner-wizard.html`: replace the `@default` placeholder's coverage of case 4 with
`@case (4) { <app-step4-summary /> }`; import `Step4Summary` into `TripPlannerWizard`.

## i18n

`trip.planner.step4.*`: `destinations`, `activities`, `timeline`, `mapView`,
`connectionNeeded`, `fixConnection`, `routeComplete`, `noActivities`, `continue` — across
en/de/fr/it. Exact key set finalized during implementation (mirrors how Step 3's key set was
finalized during its own implementation).

## Out of scope (deferred / not requested)

- Editing a stop's dates or an activity's assigned day from Summary — Summary is read-only
  except for activity removal and the connection jump-back; any other edit means going back
  to the relevant step.
- A live second map instance embedded in the Summary step itself — explicitly rejected in
  favor of reusing the collapse-to-reveal-map pattern (see Confirmed decisions).
- Drawing each added hike/bike's actual route line on the summary map — only a point marker
  at the activity's stored `lat`/`lon`; no route geometry is persisted per-activity today
  and adding it was out of scope for this phase (see the "no photos/thumbnails" decision's
  reasoning — same tradeoff applies to route shapes).

## References

- @frontend/src/app/features/trip-planner/step3-activities/step3-activities.ts
- @frontend/src/app/features/trip-planner/step2-itinerary/step2-itinerary.ts
- @frontend/src/app/shared/services/trip-planner.ts
- @frontend/src/app/shared/utils/date-range.ts
- @frontend/src/app/shell/trip-planner-layout/trip-planner-layout.ts
- @frontend/src/app/shared/map/map.ts
- @frontend/src/app/shared/drawer-host/drawer-host.ts
- @frontend/src/app/shared/services/attractions.ts
- @frontend/src/app/shared/services/trail-routes.ts
- @context/features/trip-planner-rebuild-spec.md
- @context/features/trip-planner-activities-spec.md
