# Hike/Bike Elevation Profile

## Overview

Add a real elevation profile (distance-vs-elevation chart + total ascent/descent) to the hike-detail and bike-detail drawers, matching what Garmin Connect shows when you import our GPX export (see reference screenshot in conversation: distance/ascent/descent stat row + green area chart).

## Why this wasn't in Phase 0

Confirmed during Phase 0 (`context/features/trip-planner-rebuild-spec.md`): geo.admin.ch's `ch.astra.wanderland`/`ch.astra.veloland` *identify* endpoint (used for `/api/v1/hikes` and `/api/v1/bikes`) only returns 2D geometry — easting/northing, no Z. That's why our GPX export has no `<ele>` tags. Garmin Connect isn't reading elevation from our file; it independently looks up elevation for each track point against its own terrain/DEM database after import and builds the graph itself.

geo.admin.ch has a *separate* service that does the same DEM lookup, confirmed working via a manual test:

```
POST https://api3.geo.admin.ch/rest/services/profile.json
  geom={"type":"LineString","coordinates":[[easting,northing],...]}
  sr=2056
  nb_points=<n>
```

Returns per-point samples: `{ dist, easting, northing, alts: { COMB, DTM2, DTM25 } }` — `dist` is cumulative distance in meters along the line, `alts.COMB` is geo.admin's blended best-available terrain model (falls back across DTM2/DTM25 coverage), confirmed accurate against a known segment (~490m rising to ~494m over ~920m of trail).

## Confirmed decisions

- Elevation is fetched **lazily per-route**, only when a hike/bike detail view is opened — not bundled into the `/hikes`/`/bikes` list response. A destination can return dozens of routes; eagerly profiling all of them would mean dozens of extra geo.admin.ch calls per list load for data most of which is never viewed in detail.
- New endpoints mirror the existing `/gpx` pattern: `POST /api/v1/hikes/elevation` and `POST /api/v1/bikes/elevation`, body `{ stages: [{ geometry }] }` — the client already has this from the `/hikes`/`/bikes` response (same body shape it already sends to `/gpx`), so no need to re-query geo.admin.ch's identify service by route id.
- A route's stages can be multiple disconnected line segments (confirmed during the earlier map-line-rendering fix — some routes have up to 8 stages, not necessarily contiguous or returned in geographic order). The elevation profile is built by querying `profile.json` **per line** and concatenating results with a running distance offset, exactly mirroring how `distanceKm` already sums per-line distances today. This means: total ascent/descent are correct sums across the whole route, but the distance axis can show a false "seam" at a gap between physically disconnected segments — an accepted known limitation, consistent with the existing `distanceKm` behavior, not something this feature fixes.
- No response caching in this iteration. The existing `cacheResponse()` middleware keys off `req.originalUrl`, which doesn't vary by POST body — reusing it as-is would serve one destination's elevation profile for every other route hitting the same URL. Skipping caching for now (detail views are opened far less often than list loads); revisit with a body-hash cache key if load becomes a concern.
- Chart is hand-rolled SVG (no new charting dependency), same approach as `trail-thumbnail.ts`'s hand-rolled route-shape SVG. Implementation should invoke the `dataviz` skill for the actual chart styling (colors, axis treatment, area fill) rather than improvising.
- Elevation section fails soft: if the elevation call errors or returns too few points, hide the chart (or show a small "not available" note) rather than blocking the rest of the detail view — matches the existing `loadError` pattern used elsewhere in this app (attraction/weather/hikes-list all fail this way).

## Backend

- `backend/src/utils/schweizMobilRoutes.js`: add `fetchElevationProfile(stages)`:
  - For each stage, get its lines via the existing `getLines()` helper (already handles LineString vs MultiLineString normalization).
  - For each line, POST to `profile.json` with `sr=2056` and a capped `nb_points` (exact number an implementation detail — enough for a smooth chart, e.g. in the 100–200 range, without the payload scaling unbounded on very long multi-stage routes).
  - Re-base each line's returned `dist` values to continue from the running total distance so far (so the combined profile is one continuous distance axis across all lines).
  - Compute `ascentM`/`descentM` by summing positive/negative deltas between consecutive `alts.COMB` values (fallback to `DTM25` if `COMB` is ever absent) across the full combined point list.
  - Return `{ points: [{ distanceKm, elevation }], ascentM, descentM, minElevation, maxElevation }`.
- `hikingRoutes.js` / `bikeRoutes.js`: add `getHikesElevation` / `getBikesElevation` handlers (same request/response shape as the existing `getHikesGpx`/`getBikesGpx` handlers — validate `stages` is a non-empty array, 400 otherwise).
- `routes/hikingRoutes.js` / `routes/bikeRoutes.js`: mount `router.post('/elevation', getHikesElevation)` (and bikes equivalent).

## Frontend

- `models/elevation-profile.ts`: `ElevationPoint { distanceKm: number; elevation: number }`, `ElevationProfile { points: ElevationPoint[]; ascentM: number; descentM: number; minElevation: number; maxElevation: number }`.
- `shared/services/trail-routes.ts`: add `getElevationProfile(kind: TrailKind, route: TrailRoute): Observable<ElevationProfile>` — POSTs to `/api/v1/{hikes|bikes}/elevation` with the same `{ name, stages }`-shaped body already used by `downloadGpx()` (minus `name`, which isn't needed here).
- `features/hikes/hike-detail/hike-detail.ts` (and `bikes/bike-detail/bike-detail.ts`): on payload change, fetch the elevation profile alongside (or right after) the existing route data is available — add `elevationProfile`, `elevationLoading`, `elevationError` signals, same pattern as other lazy-loaded detail data in this app.
- New shared component (e.g. `shared/elevation-chart/elevation-chart.ts`) — hand-rolled SVG area chart, `@Input() profile: ElevationProfile`, styled per the `dataviz` skill during implementation.
- `hike-detail.html` / `bike-detail.html`: new "Elevation profile" section below the existing category/distance row — ascent/descent stat pair (↑ Xm / ↓ Xm) + the chart; skeleton while loading; hidden (or soft note) on error/insufficient data.
- i18n: `hikes.elevation.*` / `bikes.elevation.*` — `title`, `ascent`, `descent`, `loadError`, across en/de/fr/it.

## References

- @backend/src/utils/schweizMobilRoutes.js
- @backend/src/controllers/hikingRoutes.js
- @backend/src/controllers/bikeRoutes.js
- @frontend/src/app/shared/services/trail-routes.ts
- @frontend/src/app/shared/trail-thumbnail/trail-thumbnail.ts
- @frontend/src/app/features/hikes/hike-detail/hike-detail.ts
- @context/features/trip-planner-rebuild-spec.md (Phase 0 — original "no elevation" decision this spec supersedes)

## History

<!-- Append implementation log here once this is picked up -->
