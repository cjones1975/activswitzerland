# Hike/Bike Multi-Day Stage Badges + "See All Stages" Map View

## Overview

SchweizMobil's national/regional hiking and cycling routes (Wanderland/Veloland) are frequently long-distance, multi-day routes broken into numbered stages (e.g. "Trans Swiss Trail" is one route split into ~20 town-to-town stages). Today, `/api/v1/hikes` and `/api/v1/bikes` search by radius around a destination and group whichever stage(s) fall within that radius into one card — the card never indicates whether it's a complete standalone route or one leg of something much longer, and there's no way to see the rest of the route.

This feature adds, to the bottom of each hike/bike list card:
- **Multi-day route**: two badges — "Stage # of a multi-day route" (or "Stages #–#" if more than one nearby stage got grouped into this card) and a "See all stages" link.
- **Single (standalone) route**: one badge — "Single route".

Clicking "See all stages" fetches every stage of that route nationwide (not radius-limited) and shows them on the map as a numbered line + numbered markers, one per stage, in visit order.

Clicking the card itself is unchanged (still opens hike-detail/bike-detail as today).

## Confirmed decisions

- **Data source**: geo.admin.ch's `ch.astra.wanderland`/`ch.astra.veloland` layers expose `chmobil_has_segment` (boolean) and encode the stage number in the feature id (`"{routeNumber}.{stageNumber}"`, e.g. `"2.09"` = stage 9 of route 2) — confirmed live against the API. `chmobil_has_segment: true` means the feature is one stage of a multi-stage route; `false` means it's a complete standalone route (e.g. "Grünes Band Bern"). Verified on both layers.
- **"See all stages" fetch is nationwide, not radius-limited.** The existing `/api/v1/hikes`/`/api/v1/bikes` endpoints use geo.admin.ch's *identify* service (point + radius/tolerance) — that's radius-bound by design and can never return a route's full stage list if some stages fall outside the search radius. geo.admin.ch has a separate *find* service that searches by attribute value across the whole layer (confirmed working: `searchField=chmobil_route_number&searchText=2` returns all ~20 Trans Swiss Trail stages, ordered by stage number, regardless of location). The new "all stages" endpoint uses *find*, not *identify*.
- **`find` requires two calls to get both attributes and geometry** — confirmed by direct testing: `returnGeometry=false` returns `attributes` (title, route number, `chmobil_has_segment`) but no geometry; `returnGeometry=true` returns `geometry` but *no* `attributes` at all (not even the route number/title). The new backend fetch must call both and merge by `id`/`featureId`. (This differs from the existing *identify*-based `fetchSchweizMobilRoutes`, which gets both in one call — don't assume the same shape.)
- **Badge text for grouped nearby stages**: if the existing radius search happens to group more than one stage of the same route into one card (two stages both within 10km), the badge shows "Stages 9–10" rather than picking just one number.
- **Map rendering for "See all stages" (confirmed via user Q&A)**:
  - Numbered circle markers (one per stage, at each stage's start point) **plus** the full stage-by-stage line geometry drawn on the map, in the route's category color (`trailCategoryColor`) — both, not markers-only.
  - Clicking "See all stages" **fully collapses** the hikes/bikes drawer (whichever the card lives in) to reveal the map, same as the existing "show on map" icon behavior elsewhere in this app.
  - Getting back to the list reuses the **existing** reopen-button (the `hike.png`/`bike.png` image button already built for `reopenHikes()`/`reopenBikes()`, shown when `hikeMarkers.hasRoutes() && drawer.isCollapsed('hikes')`) — no new button. Clicking it should also clear the all-stages overview so the map reverts to the normal nearby-search markers.
- **Single-route badge has no click behavior** — it's informational only.
- No change to `onRouteClick()` in either list component.

## Backend

### `backend/src/utils/schweizMobilRoutes.js`

- In `fetchSchweizMobilRoutes` (existing radius search): when grouping stage features by `chmobil_route_number`, also capture `hasSegment: feature.properties?.chmobil_has_segment` on the route (from the first feature seen for that route number — assumed consistent across all of a route's stages, not verified per-stage). Parse the stage number out of `feature.id` (split on `.`, `parseInt` the second part) and add it to each pushed stage as `stageNumber`.
- New export `fetchRouteStages({ layer, routeNumber, lang })`:
  1. `GET find?layer={layer}&searchField=chmobil_route_number&searchText={routeNumber}&contains=false&returnGeometry=false&lang={lang}` → attributes per stage (`chmobil_title`, `chmobil_has_segment`, and `id`/`featureId` to parse the stage number and to key the merge).
  2. `GET find?layer={layer}&searchField=chmobil_route_number&searchText={routeNumber}&contains=false&returnGeometry=true&sr=2056&geometryFormat=geojson` → geometry per stage, keyed by the same `id`/`featureId`.
  3. Merge the two by `id`, sort by parsed stage number ascending, reproject each stage's geometry to WGS84 with the existing `reprojectGeometry` helper (same as `fetchSchweizMobilRoutes` already does).
  4. Return one `TrailRoute`-shaped object: `{ routeNumber, name (from the first stage's chmobil_title, stripped of its "(...)" leg suffix if that reads better — decide during implementation), category (existing `getRouteCategory(routeNumber)`), distanceKm/distanceMiles (summed across all returned stages, same as today), stages: [{ stageId, stageNumber, title (the un-stripped "(From - To)" chmobil_title, useful for future stage-level UI), geometry, geometryWgs84 }] }`.
  - `routeNumber` in the URL/searchText should be the bare number (not the "routeNumber.stageNumber" id) — same value already available on the frontend as `TrailRoute.routeNumber`.

### `backend/src/controllers/hikingRoutes.js` / `bikeRoutes.js`

- New handler `getHikeStages`/`getBikeStages`: reads `req.params.routeNumber` and `req.query.lang`, calls `fetchRouteStages({ layer: HIKING_LAYER | BIKE_LAYER, routeNumber, lang })`, responds `{ success: true, data: route }` (404 via `ErrorResponse` if no stages found for that route number).

### `backend/src/routes/hikingRoutes.js` / `bikeRoutes.js`

- `router.get('/:routeNumber/stages', cacheResponse(), getHikeStages)` (bikes equivalent). No `convertToLV95` needed — this endpoint isn't geometry/point-based. `cacheResponse()` works fine here (unlike the POST-body elevation endpoints) since it's a GET keyed by URL, and `routeNumber`+`lang` are both already in the URL/query.

## Frontend

### `frontend/src/app/models/trail-route.ts`

- `TrailStage` gains `stageNumber: number` and `title: string` (the per-stage "(From - To)" `chmobil_title`).
- `TrailRoute` gains `isMultiDay: boolean` (from backend's `hasSegment`).

### `frontend/src/app/shared/services/trail-routes.ts`

- New method `getRouteStages(kind: TrailKind, routeNumber: string | number, lang: string): Observable<TrailRoute>` → `GET /api/v1/{hikes|bikes}/{routeNumber}/stages?lang={lang}`.

### Badge UI — `hikes-list.html`/`.ts` and `bikes-list.html`/`.ts` (mirrored in both)

- New row below the existing `trail-meta-row` (category badge + distance), inside each `.trail-card`:
  - If `route.isMultiDay`: a "Stage {n}" / "Stages {min}–{max}" badge (computed from `route.stages.map(s => s.stageNumber)`, same component as the existing category-badge styling but a distinct visual treatment) + a "See all stages" badge/link with its own `(click)="onSeeAllStages(route); $event.stopPropagation()"` (stopPropagation needed so it doesn't also trigger the card's own `onRouteClick`, same pattern already used for the existing `trail-select-row`).
  - Else: a "Single route" badge, no click handler.
- i18n: `hikes.multiDay.stage` ("Stage {{n}}"), `hikes.multiDay.stageRange` ("Stages {{start}}–{{end}}"), `hikes.multiDay.seeAllStages` ("See all stages"), `hikes.multiDay.singleRoute` ("Single route") — and the `bikes.*` equivalents — across en/de/fr/it, matching this app's existing per-feature-namespaced i18n convention (not shared keys, even though the English text is identical to the hikes ones).

### `onSeeAllStages(route)` (new method on `HikesList`/`BikesList`)

- Calls `trailRoutesService.getRouteStages('hike' | 'bike', route.routeNumber, lang)`.
- On success, stores the result on `hikeMarkers`/`bikeMarkers` (new signal, see below) and collapses the drawer (`drawerSvc.collapse('hikes')` / `'bikes'`) to reveal the map — same drawer key the list already lives in, so the existing reopen-button condition (`hikeMarkers.hasRoutes() && drawer.isCollapsed('hikes')`) picks it up with no new button.

### `HikeMarkersService` / `BikeMarkersService` — new "stage overview" state

- New signal, e.g. `stageOverview = signal<TrailRoute | null>(null)`, plus `setStageOverview()`/`clearStageOverview()`.
- Clearing must happen when the user reopens the list via the existing reopen button (`reopenHikes()`/`reopenBikes()` in `destinations-layout.ts`) — add `this.hikeMarkers.clearStageOverview()` there — so returning to the list also reverts the map to normal nearby markers.

### Map rendering — `shared/map/map.ts` / `map.html` / `map.css`

- New Inputs, e.g. `stageOverviewLines: [number, number][][] | null` and `stageOverviewStages: { lng: number; lat: number; stageNumber: number }[]`, plus a color input (reuse the existing `trailColor`-style pattern, fed `trailCategoryColor(route.category)` from the caller).
- New private method mirroring `syncTripRoute()`'s numbered-marker + GeoJSON-line approach (separate `stage-overview-line` source/layer id and a separate marker-instance array, so it doesn't collide with `trip-route-line`/`trail-route-line`/`tripStopMarkers`): draws the full stage-by-stage line and one numbered circle marker per stage (same visual treatment as `trip-stop-marker`, numbered 1..N in stage order).
- `destinations-layout.ts`/`.html`: bind the new Inputs from `hikeMarkers.stageOverview()`/`bikeMarkers.stageOverview()` (whichever is active), and gate the *existing* nearby hike/bike markers off while a stage overview is active (avoid both rendering at once) — mirrors the existing "only one category on the map" rule from `ActivityMapService`, but scoped within the hikes/bikes category itself (overview vs nearby-search markers).

## Open implementation questions to resolve when this is picked up

- Exact stripping/formatting of `chmobil_title` for the route-level `name` vs per-stage `title` (the raw title always includes the "(From - To)" leg suffix, which reads redundantly at the route level once we already show "Stage 9 of 20" separately).
- Whether `distanceKm` on the badge-triggering card (radius-limited, existing field) should get a footnote/tooltip once we know it's a partial multi-day route, so it's clear that number isn't the full route's length. Not requested, but likely to come up once this ships.

## References

- @backend/src/utils/schweizMobilRoutes.js
- @backend/src/controllers/hikingRoutes.js
- @backend/src/controllers/bikeRoutes.js
- @backend/src/routes/hikingRoutes.js
- @backend/src/routes/bikeRoutes.js
- @frontend/src/app/models/trail-route.ts
- @frontend/src/app/shared/services/trail-routes.ts
- @frontend/src/app/features/hikes/hikes-list/hikes-list.ts
- @frontend/src/app/features/hikes/hikes-list/hikes-list.html
- @frontend/src/app/shared/services/hike-markers.ts
- @frontend/src/app/shared/services/bike-markers.ts
- @frontend/src/app/shared/map/map.ts (`syncTripRoute()` — pattern to mirror for numbered stage markers/line)
- @frontend/src/app/shell/destinations-layout/destinations-layout.ts
- @context/features/hike-bike-elevation-spec.md (prior feature on this same route data — reference for tone/structure)
