# Mountain Bike Trails — Road vs. Mountain Bike Tabs

## Overview

Today `/api/v1/bikes` only ever queries SchweizMobil's `ch.astra.veloland` layer (road/city cycling routes, "Veloland") — mountain bike routes ("Mountainbikeland") aren't fetched at all, so there's no way to distinguish road vs. mountain bike trails because mountain bike trails simply aren't in the data.

This feature adds Mountainbikeland as a second, independently-fetched network, and lets the user switch between the two in the bikes drawer via a tab component — "Road trails" / "Mountain trails" — mirroring the Places/Things tab pattern already built for the homepage search box (`search-box.html`/`.ts`). Only one network's routes are fetched/shown on the map at a time, selected by the active tab.

## Confirmed decisions

- **Layer verified live** (2026-07-26, direct geo.admin.ch `identify` calls): `ch.astra.mountainbikeland` ("Mountainbikeland Schweiz") is a real, published layer, sharing the exact same attribute schema as `ch.astra.veloland`/`ch.astra.wanderland` — `chmobil_route_number`, `chmobil_title`, `chmobil_has_segment`, feature id format `"{routeNumber}.{stageNumber}"`. Confirmed via a real query near Bern: results included route number 1 = "Alpine Bike" (a national-tier route, consistent with the existing 1-digit-national/2-digit-regional/3+-digit-local convention already coded in `getRouteCategory`). No backend utility changes needed beyond passing a different `layer` value — `fetchSchweizMobilRoutes`/`fetchRouteStages` are already layer-agnostic.
- **Route numbers are NOT unique across the two networks.** Veloland and Mountainbikeland are independently numbered (each restarts 1-digit-national, 2-digit-regional, etc. on its own). A `routeNumber` alone can no longer serve as a unique key anywhere it's used as one — marker ids, `routeMap` keys, and saved-trip activity refs must all be tagged/namespaced by which network they came from.
- **Default network: `'road'`** (i.e. today's Veloland-only behavior), for continuity with existing users, saved trips, and anyone who already has the bikes drawer open.
- **Radius and category (national/regional/local) filters apply independently per active tab** — no semantic change, they just re-run against whichever network's data is currently loaded.
- **Switching tabs** refetches at the current radius for the newly active network, and resets `selectedId`/`stageOverview` (clears any selected marker, trail line, or "see all stages" overview left over from the previous tab) — otherwise a stale selected marker id from the old network could linger with nothing on the map to match it.
- **No map marker visual distinction between road and mountain bike pins** in this iteration — same icon/className (`bike-marker`), since tab-gating means only one network's markers are ever on the map at once. Listed under Open Questions as a possible future refinement, not required now.
- **Saved trips**: existing bike activities (added before this feature) have no `bikeType` and are all implicitly Veloland — treated as `'road'` wherever a saved trip's bike activity is looked up. New bike activities always write an explicit `bikeType`.

## Backend

### `backend/src/controllers/bikeRoutes.js`

- Replace the single `BIKE_LAYER` constant with:
  ```js
  const BIKE_LAYERS = { road: 'ch.astra.veloland', mountain: 'ch.astra.mountainbikeland' };
  ```
- `getBikes`: derive `const bikeType = req.query.bikeType === 'mountain' ? 'mountain' : 'road';` (defaults to `'road'` for older clients), pass `BIKE_LAYERS[bikeType]` as `layer` to `fetchSchweizMobilRoutes`.
- `getBikeStages`: same `bikeType` derivation, pass `BIKE_LAYERS[bikeType]` as `layer` to `fetchRouteStages`.
- `getBikesGpx`/`getBikesElevation` are unaffected — both operate purely on `stages` geometry the client already has, no layer lookup involved.

### `backend/src/routes/bikeRoutes.js`

- No routing changes — `bikeType` travels as a query param on the existing `GET /` and `GET /:routeNumber/stages` routes. `cacheResponse()` already keys on `req.originalUrl` (the full query string), so `road` and `mountain` requests get independent cache entries with no change to `middleware/cache.js`.

### `backend/src/models/Trip.js`

- `TripActivitySchema` gains `bikeType: { type: String, enum: ['road', 'mountain'] }` — optional (absent for non-bike activities and for bike activities saved before this feature).

## Frontend

### `frontend/src/app/shared/services/trail-routes.ts`

- `getRoutes(kind, lat, lon, lang, radius, bikeType?)` and `getRouteStages(kind, routeNumber, lang, bikeType?)` gain a trailing optional `bikeType?: 'road' | 'mountain'` param, sent as a `bikeType` query param only when provided. Hikes call sites simply never pass it.

### `frontend/src/app/models/trip.ts`

- `TripActivitySelection` gains `bikeType?: 'road' | 'mountain'` (bike-only, mirrors the backend schema change).

### `frontend/src/app/models/trail-route.ts`

- No changes — `bikeType` is a fetch-time selector, not a field on `TrailRoute` itself; whatever fetched the route already knows which network it asked for.

### `frontend/src/app/shared/services/bike-markers.ts`

- New signal `bikeType = signal<'road' | 'mountain'>('road')` + `setBikeType(type)` setter (same style as existing `setSelected`/`setHasRoutes`).
- `resetFiltersForDestination` also resets `bikeType` to `'road'` on a genuinely new destination, alongside the existing `radiusKm`/`selectedCategory` reset.
- Add a `markerId(routeNumber): string` helper returning `` `bike-${this.bikeType()}-${routeNumber}` ``, and use it both in `set()` (building `markers`/`routeMap`) and from `bikes-list.ts` (building the id passed to `setSelected`) — avoids duplicating the id-format string in two places now that it's no longer a trivial `bike-${routeNumber}`.

### `frontend/src/app/features/bikes/bikes-list/bikes-list.ts`

- Tabs read/write `bikeMarkers.bikeType()` directly (no separate component-local signal), same pattern as `radiusKm`/`selectedCategory`.
- New `onBikeTypeChange(type: 'road' | 'mountain')`: no-op if unchanged; else `bikeMarkers.setBikeType(type)`, `bikeMarkers.setSelected(null)`, `bikeMarkers.clearStageOverview()`, then `this.load()`.
- `load()`: pass `this.bikeMarkers.bikeType()` as the new trailing arg to `trailRoutesService.getRoutes(...)`.
- `onRouteClick()`: build the selected id via `this.bikeMarkers.markerId(route.routeNumber)` instead of the old inline `` `bike-${route.routeNumber}` ``.
- `onSeeAllStages()`: pass `this.bikeMarkers.bikeType()` to `getRouteStages(...)`.
- `toggleAdd()`/`addedRefIds`: the new-activity object gains `bikeType: this.bikeMarkers.bikeType()`; `addedRefIds`'s filter must also match `a.bikeType === this.bikeMarkers.bikeType()` (in addition to the existing `a.kind === 'bike'`) so a same-numbered route in the other network doesn't show a false "Added" badge.

### `frontend/src/app/features/bikes/bikes-list/bikes-list.html`

- New tabs row at the top of `.trail-list-panel`, above `.trail-filters`, following the same active/inactive button pattern as `search-box.html`'s Places/Things tabs, but as this component's own markup (not a reused `SearchBox`, different data/behavior) — new classes `trail-type-tabs`/`trail-type-tab`/`trail-type-tab--active`:
  ```html
  <div class="trail-type-tabs">
    <button type="button" class="trail-type-tab" [class.trail-type-tab--active]="bikeMarkers.bikeType() === 'road'" (click)="onBikeTypeChange('road')">
      {{ 'bikes.tabs.road' | translate }}
    </button>
    <button type="button" class="trail-type-tab" [class.trail-type-tab--active]="bikeMarkers.bikeType() === 'mountain'" (click)="onBikeTypeChange('mountain')">
      {{ 'bikes.tabs.mountain' | translate }}
    </button>
  </div>
  ```

### `frontend/src/app/features/bikes/bikes-list/bikes-list.css`

- New `.trail-type-tabs`/`.trail-type-tab`/`.trail-type-tab--active` rules, adapted from `search-box.css`'s `.search-tabs`/`.search-tab`/`.search-tab--active` (flex row, active tab gets bottom-border + color swap) but without its floating-card chrome (box-shadow/border-radius/margin: this sits at the top of a drawer panel, not a standalone card) — use this component's existing `--navy-*`/`--gray-*` variables to match `.trail-category-badge` etc.

### `frontend/src/app/shell/destinations-layout/destinations-layout.ts`

- No change needed. `onMarkerClick`'s `marker.id.startsWith('bike-')` branch and the `selectedMarker`/`trailRoute`/`trailColor` computeds already key generically off whatever id format `bikeMarkers.routeMap()`/`selectedId()` use — since both `bike-markers.ts` and `bikes-list.ts` move to the new `bike-{type}-{routeNumber}` id consistently, this file doesn't need to know the format changed.

### `frontend/src/app/shell/trip-planner-layout/trip-planner-layout.ts`

- `onActivityMarkerClick`'s bike branch: change `this.trailRoutesService.getRoutes(kind, stop.lat, stop.lon, lang)` to pass `activity.bikeType ?? 'road'` as the trailing `bikeType` arg (the `?? 'road'` fallback covers saved trips predating this feature). The subsequent `routes.find(r => String(r.routeNumber) === activity.refId)` is unchanged.

### i18n — `bikes.tabs.road` / `bikes.tabs.mountain`

- en: "Road trails" / "Mountain trails".
- de/fr/it: natural translations in the same pass, per the standing rule to mirror every en.json copy change into all locales ([[feedback_i18n_translate_all_locales]]).

## Open questions (not blocking, flag for later)

- Should mountain bike vs. road bike markers get visually distinct icons/colors, in case a future change shows both networks on the map at once (today's tab-gating makes this a non-issue)?
- Should `bike-detail` surface which network a route belongs to anywhere in its header — useful if a user revisits a saved trip and doesn't remember which tab they picked a route from?
- Verify against at least one real pre-existing saved trip once this ships, to confirm the `bikeType ?? 'road'` fallback resolves correctly end-to-end.

## References

- @backend/src/controllers/bikeRoutes.js
- @backend/src/routes/bikeRoutes.js
- @backend/src/utils/schweizMobilRoutes.js (layer-agnostic, confirmed no changes needed)
- @backend/src/models/Trip.js
- @frontend/src/app/shared/services/trail-routes.ts
- @frontend/src/app/shared/services/bike-markers.ts
- @frontend/src/app/models/trip.ts
- @frontend/src/app/models/trail-route.ts
- @frontend/src/app/features/bikes/bikes-list/bikes-list.ts
- @frontend/src/app/features/bikes/bikes-list/bikes-list.html
- @frontend/src/app/features/bikes/bikes-list/bikes-list.css
- @frontend/src/app/features/search/search-box/search-box.html (tab pattern to mirror)
- @frontend/src/app/features/search/search-box/search-box.css (tab styling to adapt)
- @frontend/src/app/shell/destinations-layout/destinations-layout.ts (confirmed no change needed)
- @frontend/src/app/shell/trip-planner-layout/trip-planner-layout.ts
- @context/features/hike-bike-multi-day-stages-spec.md (prior feature on this same route data — reference for tone/structure)
