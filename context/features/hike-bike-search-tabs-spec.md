# Search Page: Hiking / Road Bike / Mountain Bike Tabs

## Overview

The `/search` page currently has two tabs — "Places to visit" (destinations) and "Things to do" (attractions) — each backed by a text-search endpoint. This feature adds three more: **Hiking trails**, **Road bike trails**, **Mountain bike trails**, searching by name against the same SchweizMobil layers already used for radius-based discovery (`ch.astra.wanderland` / `ch.astra.veloland` / `ch.astra.mountainbikeland`), via geo.admin.ch's `find` service instead of the radius-bound `identify` service.

Result click opens the existing `hike-detail`/`bike-detail` drawer, mirroring how attraction search results already open `attraction-detail` with `source: 'search'` — this is a well-trodden path, not new plumbing.

## Confirmed decisions

- Road and mountain bike trails get **separate tabs**, not one "Bikes" tab with a toggle — matches the existing `bikes-list` road/mountain tab split ([[project_trip_planner]] era pattern, see `mountain-bike-spec.md`).
- Tab labels/order: **Places to visit, Things to do, Hiking trails, Road bike trails, Mountain bike trails**. On mobile the row scrolls horizontally rather than wrapping or shrinking to fit — 5 tabs don't fit one screen width at a legible size.
- geo.admin.ch's `find` endpoint caps at ~201 results per call regardless of query breadth (confirmed live, both with a wildcard `find` search and a large-radius `identify` search — both stopped at exactly 201). **Accepted, not a blocker** — a search results page silently capping at ~200 hits for an extremely broad query (e.g. a single common letter) is a reasonable trade-off, unlike the radius-search case where completeness matters more.
- Search results have no associated destination (unlike list-in-drawer flows, which are always opened from a specific destination). `HikeDetailPayload.destination` / `BikeDetailPayload.destination` must become **optional** — confirmed safe: neither `hike-detail.ts`/`.html` nor `bike-detail.ts`/`.html` currently read `payload.destination` themselves; it only exists for `drawer-host.ts`'s back-navigation and other payload builders that always have one.

## Backend

### `backend/src/utils/schweizMobilRoutes.js`

- Extract the route-grouping + enrichment logic currently inline at the end of `fetchSchweizMobilRoutes` (grouping stage-features by `chmobil_route_number`, the `totalStagesByRoute` nationwide-count enrichment, and the final `distanceKm`/`geometryWgs84` mapping) into a new shared async function:
  ```js
  async function buildRoutesFromFeatures(features, { layer, lang }) { ... }
  ```
  taking an array of `{ id, properties, geometry }`-shaped features (the same shape `identify` results already have). `fetchSchweizMobilRoutes` becomes: call `identify`, then `return buildRoutesFromFeatures(response.data.results || [], { layer, lang })`.
- New function `searchSchweizMobilRoutes({ layer, query, lang })`:
  - Two parallel `find` calls against `GEOADMIN_FIND_URL`, same two-call attributes+geometry merge pattern already used by `fetchRouteStages` (`returnGeometry: false` for attributes, `returnGeometry: true, sr: 2056, geometryFormat: 'geojson'` for geometry, merged by feature id) — but with `searchField: 'chmobil_title', searchText: query, contains: true` instead of a route-number lookup.
  - Normalize each merged `{ id, attrs, geometry }` into `{ id, properties: attrs, geometry }` (matching `identify`'s shape) so the merged list can feed straight into `buildRoutesFromFeatures`.
  - Return `buildRoutesFromFeatures(mergedFeatures, { layer, lang })`.
- No change to `fetchRouteStages`, `fetchStageCount`, `buildGpx`, `fetchElevationProfile`.

### `backend/src/controllers/hikingRoutes.js`

- New handler:
  ```js
  // @desc    Search hiking routes by name
  // @route   GET /api/v1/hikes/search?q=&lang=
  // @access  Public
  export const getHikesSearch = asyncHandler(async (req, res, next) => {
      const query = (req.query.q || '').trim();
      if (!query) return next(new ErrorResponse('q query param is required', 400));

      try {
          const hikes = await searchSchweizMobilRoutes({ layer: HIKING_LAYER, query, lang: req.query.lang });
          res.status(200).json({ success: true, count: hikes.length, query, data: hikes });
      } catch (error) {
          console.error(error);
          next(new ErrorResponse(`An error occurred during the request: ${error.message}`, 500));
      }
  });
  ```
- Import `searchSchweizMobilRoutes` alongside the existing imports from `../utils/schweizMobilRoutes.js`.

### `backend/src/controllers/bikeRoutes.js`

- Same shape, additionally resolving `bikeType` via the existing `resolveBikeType(req)` helper and passing `BIKE_LAYERS[bikeType]` as `layer`.

### `backend/src/routes/hikingRoutes.js` / `backend/src/routes/bikeRoutes.js`

- Add `router.get('/search', cacheResponse(), getHikesSearch);` (and the bikes equivalent). No `convertToLV95` middleware — there's no lat/lon on this route. Placement doesn't matter relative to `/:routeNumber/stages` since `/search` is a distinct literal path, not a value that could be captured by `:routeNumber`.

## Frontend

### `frontend/src/app/shared/services/trail-routes.ts`

- New method:
  ```ts
  searchRoutes(kind: TrailKind, query: string, lang: string, bikeType?: BikeType): Observable<TrailRoute[]> {
    let params = new HttpParams().set('q', query).set('lang', lang);
    if (bikeType) params = params.set('bikeType', bikeType);
    return this.http
      .get<TrailRoutesResponse>(`${environment.apiUrl}/api/v1/${KIND_PATH[kind]}/search`, { params })
      .pipe(map(res => res.data));
  }
  ```

### New: `frontend/src/app/features/search/hike-search-results/`

- `hike-search-results.ts`, structurally identical to `AttractionSearchResults`: `@Input({required:true}) query`, `ngOnChanges` refetches on query change, `results`/`loading`/`error`/`searched` signals, `skeletons`.
- Fetch via `trailRoutesService.searchRoutes('hike', this.query, this.langSvc.current)`.
- `onResultClick(route)` opens `hike-detail` with:
  ```ts
  const payload: HikeDetailPayload = { route, source: 'search', searchQuery: this.query, searchTab: 'hikes' };
  this.drawerSvc.open('hike-detail', payload);
  ```
  (no `destination` — now optional, see below).
- Template: reuse the visual pieces of `hikes-list.html`'s `.trail-card` (thumbnail via `<app-trail-thumbnail>`, name, category badge, multi-day badge via the same `stageBadge()`-style logic, distance via `formatDistanceKmMi`) but without the radius/category filter row or the `mode === 'select'` day-picker/add-to-trip block — this is a simpler, view-only card, closer to `attraction-search-results.html`'s structure than to the full `hikes-list.html`.

### New: `frontend/src/app/features/search/bike-search-results/`

- Same shape as above, plus `@Input({required:true}) bikeType: BikeType`. Fetch via `trailRoutesService.searchRoutes('bike', this.query, this.langSvc.current, this.bikeType)`. Two tab instances of this one component, one per bike type (`[bikeType]="'road'"` / `[bikeType]="'mountain'"`), rather than two separate components — the only per-type difference is which layer gets searched, already handled by the existing `bikeType` param plumbing.
- `onResultClick(route)` sets `searchTab: this.bikeType === 'mountain' ? 'bikes-mountain' : 'bikes-road'`.

### `frontend/src/app/features/hikes/hike-detail/hike-detail.ts`

- `HikeDetailPayload`:
  ```ts
  export interface HikeDetailPayload {
    route: TrailRoute;
    destination?: GeoLocation;   // was required; absent when source === 'search'
    mode?: 'view' | 'select';
    stopId?: string;
    source?: 'trip-summary' | 'explore-trips' | 'search';
    searchQuery?: string;
    searchTab?: 'hikes';
  }
  ```
- No changes needed inside the component class/template — confirmed `payload().destination` is never read there today.

### `frontend/src/app/features/bikes/bike-detail/bike-detail.ts`

- Same treatment: `destination?` optional, `source` gains `'search'`, add `searchQuery?: string` and `searchTab?: 'bikes-road' | 'bikes-mountain'`. Verify (mirror the hike-detail check) that `payload().destination` isn't read directly in `bike-detail.ts`/`.html` before assuming it's equally safe to make optional there.

### `frontend/src/app/shared/drawer-host/drawer-host.ts`

Mirror the existing `attraction-detail` handling for `source === 'search'` exactly:

- `isHikeDetailTripPlanner` / `isBikeDetailTripPlanner`: add `|| payload?.source === 'search'` to the existing condition (treats it as a sticky modal with no map reveal behind it, same reasoning already documented on `isAttractionDetailTripPlanner`: "neither /search nor /explore-trips has a map view behind it").
- `onHikeDetailBack()` / `onBikeDetailBack()`: add, before the existing fallback branch that reopens the `hikes`/`bikes` list drawer:
  ```ts
  if (payload.source === 'search') {
    this.langSvc.navigate(['search'], { queryParams: { q: payload.searchQuery, tab: payload.searchTab } });
    return;
  }
  ```
  The existing fallback (`this.svc.open('hikes', { destination: payload.destination, ... })`) is only reached for the other sources, which always carry a real `destination` — unaffected by the type becoming optional.

### `frontend/src/app/features/search/search-box/search-box.ts`

- `SearchTab` type expands: `'places' | 'things' | 'hikes' | 'bikes-road' | 'bikes-mountain'`.
- Placeholder text currently a binary ternary in the template (`activeTab() === 'places' ? ... : ...`) — replace with a `Record<SearchTab, string>` lookup (component field or computed) mapping each tab to its i18n placeholder key, since a 5-way ternary in the template would be unreadable.

### `frontend/src/app/features/search/search-box/search-box.html` + `.css`

- Add 3 more `.search-tab` buttons for the new tabs. Icons: `fa-solid fa-person-hiking` (hikes) and `fa-solid fa-bicycle` (road bikes) — both already used elsewhere in the app (`destination-detail.html`) for the same concepts — plus `fa-solid fa-person-biking-mountain` (mountain bikes, user-confirmed 2026-08-20; matched to `fa-solid` for weight consistency with the other four tab icons, none of which existed anywhere in the codebase before this feature).
- `.search-tabs` currently `display: flex` with each `.search-tab` at `flex: 1` (5 equal-width tabs would be cramped and wouldn't scroll). Change to a horizontally scrollable row: `.search-tabs { display: flex; overflow-x: auto; }` + `.search-tab { flex: 0 0 auto; ... }`, sized so 2-3 tabs are visible at once on a phone width and the rest reachable by scrolling right, per the confirmed decision above.

### `frontend/src/app/features/search/search-page/search-page.ts` + `.html`

- `activeTab` signal type follows `SearchTab`'s expansion; URL tab param parsing (`params.get('tab') === 'things' ? 'things' : 'places'`) needs to become a full switch/lookup over all 5 values instead of the current binary fallback-to-places.
- Add 3 more `<p-tab>` / `<p-tabpanel>` pairs, rendering `<app-hike-search-results [query]="query()" />` and two `<app-bike-search-results [query]="query()" [bikeType]="'road'" />` / `[bikeType]="'mountain'"` instances.
- Add `[scrollable]="true"` to the `<p-tabs>` element — PrimeNG's Tabs component has a built-in `scrollable` input that renders prev/next nav buttons and scrolls the tab list, confirmed present in the installed package (`primeng/types/primeng-tabs.d.ts`). This covers the results-page tab row; `search-box.html`'s tabs (the homepage widget, hand-rolled markup, not PrimeNG) need the manual CSS scroll treatment described above instead.

## i18n

New keys needed in `en.json`, mirrored into `de`/`fr`/`it` in the same pass ([[feedback_i18n_translate_all_locales]]):
- `home.search.hikesTab` — "Hiking trails"
- `home.search.bikesRoadTab` — "Road bike trails"
- `home.search.bikesMountainTab` — "Mountain bike trails"
- `home.search.placeholderHikes` / `placeholderBikesRoad` / `placeholderBikesMountain`
- `home.search.noHikeResults` / `noBikeResults` (or one shared "no trails found" key reused by both, if the copy doesn't need to distinguish)

## Open questions (not blocking, flag for later)

- Should the "obstacle-free routes" gap ([[project_wheelchair_accessible_flag_missing]]) matter here? No — unrelated, noted only because it's the same data source.

## References

- @backend/src/utils/schweizMobilRoutes.js
- @backend/src/controllers/hikingRoutes.js
- @backend/src/controllers/bikeRoutes.js
- @backend/src/routes/hikingRoutes.js
- @backend/src/routes/bikeRoutes.js
- @backend/src/middleware/cache.js (confirmed `cacheResponse()` keys on full `req.originalUrl`, safe to reuse as-is for `/search?q=...`)
- @frontend/src/app/shared/services/trail-routes.ts
- @frontend/src/app/features/search/attraction-search-results/attraction-search-results.ts (structural template for the two new components)
- @frontend/src/app/features/hikes/hikes-list/hikes-list.html (trail-card visual pieces to reuse)
- @frontend/src/app/features/hikes/hike-detail/hike-detail.ts
- @frontend/src/app/features/bikes/bike-detail/bike-detail.ts
- @frontend/src/app/shared/drawer-host/drawer-host.ts (`onAttractionDetailBack`/`isAttractionDetailTripPlanner` — exact pattern being mirrored for hikes/bikes)
- @frontend/src/app/features/search/search-box/search-box.ts
- @frontend/src/app/features/search/search-box/search-box.html
- @frontend/src/app/features/search/search-box/search-box.css
- @frontend/src/app/features/search/search-page/search-page.ts
- @frontend/src/app/features/search/search-page/search-page.html
- @context/features/mountain-bike-spec.md (prior art for the road/mountain split and the general file-by-file spec format)
