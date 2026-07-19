# Per-Destination Attraction Search Area (geo.bbox instead of a fixed radius)

## Overview

Attraction searches for a destination (`all-attractions.ts`, `attraction-vertical-list.ts`) currently use MySwitzerland's `geo.dist` parameter with one fixed radius (`NEARBY_RADIUS_M`, currently 22km) applied to every destination equally. A fixed radius is a poor fit for a country where city size/density varies enormously — the same 22km circle is too small for some places and pulls in a neighboring, unrelated town for others (confirmed during testing: a Geneva destination's `geo.dist` search without a radius pulled in Neuchâtel and Bern, ~130-160km away).

This feature replaces the fixed-radius search, **only for City Breaks destinations**, with each destination's actual municipality boundary box, sourced from geo.admin.ch (Switzerland's official geodata service, which this app already integrates with for hiking/biking routes). Every other case — mountains/lakes/nature-park destinations, and trip-planner's free-text stops — keeps today's fixed-radius `geo.dist` behavior unchanged; this is a deliberate, narrow v1 scope, not a partial implementation of a broader goal.

## Confirmed decisions (from live API testing)

- **The attractions API's box parameter is `geo.bbox`, not `geo.box`.** `geo.box` is silently ignored by MySwitzerland's API — every value tested against it (including a tiny, obviously-restrictive box) returned the same ~1476-result count as no filter at all, meaning it's not a real parameter. `geo.bbox` genuinely filters: a small box around Geneva returned 30 results, an equivalent box around Zürich returned 36, a larger Geneva box returned 32 — all plausible, distinct counts.
- **`geo.bbox` format is `minLat,minLon,maxLat,maxLon`** — confirmed by testing both axis orders directly; `lon,lat,lon,lat` returned 0 (an inverted/invalid box), `lat,lon,lat,lon` returned real counts. This is a different order from `geo.dist`, which is `lat,lon,radiusMeters`. Do not assume the two share a format.
- **MySwitzerland's own destination records have no bounding box** — confirmed by inspecting a raw `/v1/destinations/:id` response: only a single `geo: {latitude, longitude}` point, same as what the app already stores. Nothing to unlock there.
- **geo.admin.ch's `SearchServer` (`type=locations`) returns real municipality boundary boxes**, and its fuzzy matching tolerates English/French destination-name variants reasonably well (confirmed: searching "Geneva" correctly surfaces "Genève"/"Genf", same box; "Lucerne" matches directly). This is the source to use, restricted to `origins=gg25` (the municipality-boundary layer) — broader `origins` (`gazetteer`, `district`) either return single-point matches (zero-area boxes, useless) or boxes far too large (a `district` match for Interlaken was ~50km+ across, not what a user means by "Interlaken").
- **Many destinations won't get a usable match, and that's expected, not a bug to work around.** MySwitzerland's destination catalogue includes mountains, lakes, and individual landmarks alongside real towns — confirmed by testing: "Matterhorn" (a peak) and "Ticino" (a whole canton) return no `gg25` municipality match at all; "Lej da Staz" (a lake) matches a small, correctly-sized lake polygon via `gazetteer`, an inconsistent case not covered by this first iteration. **Scope for this feature: only destinations that resolve to a real `gg25` municipality match get a bbox; everything else keeps today's fixed-radius `geo.dist` behavior unchanged.** This is a deliberate v1 scope cut, not an oversight — expanding matching to lakes/peaks/regions is a natural follow-up once this ships and the fallback path is proven.
- **The bbox attempt itself is gated by MySwitzerland's own city classification, not the UI category the user clicked through.** Confirmed on Geneva's raw destination payload: `classification` already includes `{"name":"placetypes","values":[{"name":"cities","title":"Cities"}]}` — the exact same facet the home page's City Breaks tile already filters on (`facet="placetypes:cities"` in `home.html`). Only destinations whose `classification` includes `placetypes:cities` are attempted at all; everything else (mountains, lakes, nature parks) skips the geo.admin.ch lookup entirely and goes straight to `geo.dist`. This is a real data field on the destination, reliable regardless of how the user navigated to it (search, direct link, etc.) — not inferred from home-page click state.
- **Trip-planner stops are explicitly out of scope.** Trip-planner's stop search (`GeoPoint`) is free-text/geocoded, never a catalogued MySwitzerland `Destination` — it has no `classification` field to gate on at all, and `all-attractions.ts` is shared between the destination-detail "See All" flow (always a `Destination`) and trip-planner's step3-activities picker (always a `GeoPoint`, `mode: 'select'`). The implementation must type-guard with the existing `isDestination()` helper (`shared/utils/geo-location.ts`) and only ever attempt bbox when it's a real `Destination` — `GeoPoint` stops always use `geo.dist`, unconditionally, no exceptions carved out for this later without also solving "what does 'is this a city' mean for an arbitrary geocoded point" first.
- **Match confidence**: `SearchServer` results carry a `weight` field (confirmed: searching "Bern" ranks the exact match at `weight: 100` vs `6` for the German/French label variants of the same result) — take the highest-weight `gg25` result, not just the first one blindly.
- **Reject degenerate matches**: a `gg25` result whose box has ~zero area (a point, not a polygon) must be treated as no-match, not used as a 0m×0m bbox.
- **Small padding around the raw municipality box is worth adding** (not yet sized — decide during implementation, something like 10-20%) — a strict legal commune boundary can exclude an attraction just over the line in a neighboring commune that a user would still consider "in [destination]". Padding only applies to the box, not a re-fetch.
- **Locale/language robustness — tested, not assumed.** Since the destination name passed to geo.admin.ch will be whatever the app's current UI language returned from MySwitzerland (EN/DE/FR/IT today), I directly tested all four: Italian ("Ginevra", "Losanna", "Zurigo", "Berna", "Coira") and German ("Sitten", "Chur") variants of city names *all* matched at `weight: 100`, identical box to the English/French versions already tested. This isn't fuzzy-matching tolerance — geo.admin.ch's index natively stores each municipality's official name in all of Switzerland's national languages, which is why every variant hit cleanly. The genuine unknown is a *future* UI language that isn't a Swiss national language or English (e.g. Spanish) — untestable today since it doesn't exist, but not a silent-failure risk either: an unmatched/mistranslated name just produces no result (or a low-weight one, already rejected per the confidence rule above), which correctly falls through to the existing `geo.dist` fallback rather than returning a wrong box.
- **Caching**: municipality boundaries never change — cache the resolved bbox per destination far longer than the existing 1-day default (`cacheResponse()`'s `ttl` param already supports overriding this per-route; use something like 30 days).
- **No new round-trip from the frontend.** The bbox lookup is folded into the existing `getDestination` controller (backend-side, server-to-server call to geo.admin.ch, response field added to what's already returned) rather than a separate endpoint the frontend has to call and wait on before it can search attractions — destination detail is already fetched once per destination view before the attraction queries fire.

## Backend

### New helper — `backend/src/utils/destinationBbox.js` (or similar)

- `getDestinationBbox(name)`:
  1. `GET https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText={name}&type=locations&sr=4326&origins=gg25` (no API key needed — same public, keyless geo.admin.ch service already used by `schweizMobilRoutes.js`).
  2. From `results`, pick the highest-`attrs.weight` entry (if any).
  3. Parse `attrs.geom_st_box2d`, format `"BOX(lonMin latMin,lonMax latMax)"` — regex out the 4 numbers.
  4. Reject if the box is degenerate (lonMin===lonMax or latMin===latMax) or implausibly large (sanity threshold, e.g. reject anything wider than ~40km across — catches stray `district`-scale mismatches).
  5. Apply the padding decided during implementation.
  6. Return `{ minLat, minLon, maxLat, maxLon }` (already in the axis order `geo.bbox` needs) or `null` if no acceptable match.

### `backend/src/controllers/myswitzerland.js` — `getDestination`

- After fetching the raw MySwitzerland destination, check whether `response.data.data.classification` includes a `placetypes` entry with a `cities` value. Only if so, call `getDestinationBbox(response.data.data.name)` and attach the result onto the response payload (e.g. `response.data.data.bbox = ...`); otherwise (or on no match) leave it `null`/absent — non-city destinations never even make the geo.admin.ch call. Wrap in try/catch so a geo.admin.ch failure never breaks destination loading — falls back to `null`/no-bbox, same as a genuine no-match.
- Mount with a longer cache TTL: `router.get('/destinations/:id', cacheResponse(THIRTY_DAYS_SECONDS), getDestination)` in `routes/myswitzerland.js` (new constant alongside the existing `ONE_DAY_SECONDS` in `middleware/cache.js`). Note this lengthens the cache for the *whole* destination response, not just the bbox part — acceptable since destination content itself is also fairly static, but worth flagging as a side effect of reusing this endpoint rather than a dedicated one.

### `backend/src/controllers/myswitzerland.js` — `getAttractions`/`getTopAttractions`/`searchAttractions`

- Add `geo.bbox` passthrough alongside the existing `geo.dist`/`placeId` handling (same `req.query['geo.bbox']`-conditional pattern already used for `geo.dist`). All three attraction controllers need this, mirroring how `geo.dist` support was added to all three.

## Frontend

### `frontend/src/app/models/destination.ts`

- `Destination` gains `bbox?: { minLat: number; minLon: number; maxLat: number; maxLon: number } | null` and `classification?: { name: string; values: { name: string; title: string }[] }[]` (the latter only strictly needed if the frontend itself ever needs to re-check city status — the primary gate is server-side in `getDestination`, see above, so this may not end up needed on the frontend model at all; confirm during implementation before adding dead weight to the type).

### `frontend/src/app/shared/services/attractions.ts`

- `getTopAttractions`/`getAttractions`/`searchAttractions` params gain an optional `geoBbox?: string` (format `minLat,minLon,maxLat,maxLon`), same conditional-set pattern as the existing `geoDist`.

### `all-attractions.ts` / `attraction-vertical-list.ts`

- `attraction-vertical-list.ts` is only ever embedded in destination-detail (`@Input() lat`/`@Input() lon` are always sourced from a real `Destination`, confirmed in `destination-detail.html`) — no `isDestination()` guard needed here, just: if `dest.bbox` is present, send `geoBbox` built from it; otherwise keep sending `geoDist` with the existing radius constant exactly as today. Needs `@Input() bbox` added alongside the existing `lat`/`lon`, passed from `destination-detail.html` (`[bbox]="dest.bbox"`).
- `all-attractions.ts` is **shared** between destination-detail's "See All" flow (`destination` is a `Destination`) and trip-planner's step3-activities picker (`destination` is a `GeoPoint`, `mode: 'select'`) — its `destination` field is already typed `GeoLocation | null` for exactly this reason. Must type-guard with the already-imported `isDestination()` (`shared/utils/geo-location.ts`, previously imported here and removed when the code was simplified to always use `geoDist` — re-add it) before ever reading `.bbox`: `isDestination(dest) && dest.bbox ? geoBbox : geoDist`. A `GeoPoint` stop always falls through to `geoDist`, unconditionally.

### i18n / UI

- No user-visible strings — this is purely a backend search-area change, same result cards/markers as today either way.

## Open implementation questions to resolve when this is picked up

- Exact padding percentage/method for the municipality box (implementation detail, not yet decided).
- The "implausibly large, reject it" threshold for `getDestinationBbox` — 40km was floated above as a starting sanity check, not verified against a wide sample of destinations.
- Whether `getDestination`'s longer cache TTL (needed for the bbox) causes any staleness concern for other destination fields that *do* change more often (e.g. photos) — worth a quick check of what MySwitzerland actually updates on a destination record before committing to 30 days.

## References

- @backend/src/controllers/myswitzerland.js
- @backend/src/routes/myswitzerland.js
- @backend/src/middleware/cache.js
- @backend/src/utils/schweizMobilRoutes.js (existing precedent for a keyless geo.admin.ch integration)
- @frontend/src/app/models/destination.ts
- @frontend/src/app/shared/services/attractions.ts
- @frontend/src/app/features/attractions/all-attractions/all-attractions.ts
- @frontend/src/app/features/attractions/attraction-vertical-list/attraction-vertical-list.ts
- @frontend/src/app/features/destinations/destination-detail/destination-detail.html
- @frontend/src/app/shared/utils/geo-location.ts (`isDestination()` type guard — needed to gate bbox usage in the shared `all-attractions.ts`)
- @frontend/src/app/features/home/home.html (existing `facet="placetypes:cities"` precedent for the same classification value this feature gates on)
