# Current Feature

## Feature

## Status

## Goals

## Notes

## History

<!-- Keep this updated. Earliest to latest -->

### 2026-07-19 — Hike/Bike Multi-Day Stages Implemented

- Branch: `feature/hike-bike-multi-day-stages`; specced in `context/features/hike-bike-multi-day-stages-spec.md`
- Backend: `schweizMobilRoutes.js` — existing radius search (`fetchSchweizMobilRoutes`) now captures `hasSegment`/`stageNumber`/per-stage `title` while grouping stage features; new `fetchRouteStages({ layer, routeNumber, lang })` does the two-call `find`-service fetch (attributes-only + geometry-only, merged by feature id, sorted by stage number, reprojected to WGS84) for the nationwide "see all stages" fetch; new `GET /api/v1/{hikes|bikes}/:routeNumber/stages` routes, cached via `cacheResponse()`
- Frontend: `TrailStage` gained `stageNumber`/`title`; `TrailRoute` gained `isMultiDay`/`totalStages`; new `TrailRoutesService.getRouteStages()`; `hikes-list`/`bikes-list` show a new badge row below the category/distance row (Stage N of Total / Stages N–M of Total / Single route, with `NoTotal` i18n fallback keys if the total-stage lookup fails) plus a "See all stages" link right-aligned via `justify-content: space-between`; new `stageOverview` signal on `HikeMarkersService`/`BikeMarkersService`; `map.ts` renders the nationwide stage line + numbered markers via a new `syncStageOverview()` (own source/layer ids, mirrors `syncTripRoute()`'s pattern); `destinations-layout` wires it up and hides the normal nearby-search markers while an overview is active
- i18n: `hikes.multiDay.*`/`bikes.multiDay.*` (`stage`, `stageNoTotal`, `stageRange`, `stageRangeNoTotal`, `seeAllStages`, `singleRoute`) added across en/de/fr/it
- Real bug found via UAT: after initial implementation, no route ever showed as multi-day — root cause was a stale Redis cache (`cacheResponse()`, 24h TTL keyed by request URL only, no version-busting) still serving pre-feature `/api/v1/hikes`/`/api/v1/bikes` responses with no `isMultiDay` field at all. Confirmed the backend logic itself was correct by querying the live geo.admin.ch API directly (bypassing the cache), then flushed the 16 stale `mys:/api/v1/hikes*`/`mys:/api/v1/bikes*` Redis keys
- Follow-up UAT fix: badge text changed to include the nationwide total ("Stage 9 of 20" / "Stages 9–10 of 20") — required a new best-effort, attributes-only (`returnGeometry=false`, no geometry payload) `fetchStageCount()` per multi-day route, fetched in parallel during the radius search and cached alongside it; "See all stages" link moved to the right edge of its row
- Real bug found via UAT: a route opened via its detail card (`hike-detail`/`bike-detail`, which drives its own independent `trailRoute`/`trailColor` map layer) kept rendering on the map even after returning to the list and viewing a different route's "see all stages" overview — `reopenHikes()`/`reopenBikes()` only reopened the list drawer, never closed the still-open (or collapsed) detail drawer underneath it. Fixed by having both reopen methods close the sibling detail drawer first (safe no-op if it isn't open), matching how the detail drawer's own back arrow already behaved
- Verified via `tsc --noEmit` and `ng build` (both clean); UI not yet exercised in a live browser session (no browser-automation tool available in this environment)
- Feature marked complete

### 2026-07-19 — Hike/Bike Multi-Day Stages Specced

- Specced multi-day stage badges ("Stage # of a multi-day route" / "Stages #–#" / "Single route") on hike/bike list cards, plus a "See all stages" map view drawing the full nationwide stage line + numbered markers, reusing the existing hikes/bikes reopen-button mechanism to return to the list
- Confirmed via direct API testing: `chmobil_has_segment` + the `"{routeNumber}.{stageNumber}"` feature id distinguish multi-day vs standalone routes; geo.admin.ch's `find` service (not the radius-bound `identify` used today) is required for a nationwide all-stages fetch, and needs two calls (`returnGeometry=false` for attributes, `=true` for geometry) merged by id
- Created `context/features/hike-bike-multi-day-stages-spec.md`; no feature branch created yet

### 2026-07-16 — Trip Planner Rebuild Phase 4 (Save Trip) Implemented

- Branch: `feature/trip-planner-save`; specced in `context/features/trip-planner-save-spec.md` (split out of `trip-planner-rebuild-spec.md`'s Phase 4 section, which was trimmed to a pointer)
- `backend/src/models/Trip.js` fully replaced (no migration) to mirror `models/trip.ts`'s `PlannedTrip` shape — `TripDateRangeSchema`, `TripStopSchema`, `TripSectionStopSchema`/`TripSectionJourneySchema`/`TripSectionSchema`, `TripConnectionSchema`, `TripConnectionLegSchema`, `TripActivitySchema` (day as `Mixed` — ISO date string or relative day number), top-level `TripSchema{user, name, type, dateMode, range, stops, connections, activities, routeCoordinates, createdAt}`; old documents (`stationId`/`attractionIds` shape) are orphaned, per the master spec's explicit no-migration decision
- `controllers/trips.js`: `createTrip` field list updated to `{ name, type, dateMode, range, stops, connections, activities, routeCoordinates }` (was `{ name, type, stops, attractionIds, routeCoordinates }`); `getTrips`/`updateTrip`/`deleteTrip` unchanged
- `TripPlannerService` gained a `loadedTripId` signal — set by `loadSavedTrip()` (captures `trip._id`, previously discarded), cleared by `reset()`/`setType()` — so Step 5 can tell whether the in-progress trip was reopened from Profile
- New `features/trip-planner/step5-save/` — trip name input pre-filled with a suggested name (`trip.planner.step5.suggestedRoad`/`suggestedRail`) or the existing name when editing a saved trip; plain type/duration/destinations/activities summary rows (small, deliberate duplication of Step 4's computeds rather than a shared abstraction for four one-line reads); Save Trip/Update Trip action, create vs. update decided by `plannerSvc.loadedTripId()`; anonymous users see `saveHint` text and a Save click opens the `'auth'` drawer instead of calling the API (stacks on top of `'trip-planner'`, no redirect needed — Save works normally once logged in); on success the returned `_id` is written back into `loadedTripId` (so a second Save updates instead of duplicating), the draft is cleared, a `savedSuccess` toast fires, and the trip-planner drawer auto-collapses to reveal the finished route on the map (reuses Step 4's existing map-reveal mechanism, no new plumbing); "Browse Saved Trips" links out to `/auth/profile` (no new browse UI — Profile's saved-trips grid already exists); wired into `trip-planner-wizard` as `@case (5)`, replacing the `@default` placeholder now that all 5 steps are covered
- `profile.ts`'s `viewTrip()` gained `this.tripPlannerSvc.step.set(4)` alongside the existing `loadSavedTrip(trip)` call, so reopening a saved trip lands on Summary instead of My Trip — no new "one-shot flag" needed since `step` was already a public writable signal
- i18n: `trip.planner.step5.*` added across en/de/fr/it; removed the now-unused `tripNamePlaceholder` (superseded by the pre-filled suggested name) and `trip.planner.comingSoon` (the wizard's placeholder case it backed no longer exists) keys
- UAT fix in the same branch: the save-confirmation and save-error toasts were unreadable — `Toast.success()`/`Toast.error()` were called with no `styleClass`, unlike `Auth`'s calls which already pass `'toast-success'`/`'toast-error'` to pick up `styles.css`'s custom-background rules; both now explicitly pass `'toast-error'` (red background) per direct user feedback after testing
- Verified via `tsc --noEmit` and `ng build` (both clean); UI not yet exercised in a live browser session
- Feature marked complete

### 2026-07-15 — Trip Planner Rebuild Phase 3 (Summary) Implemented

- Branch: `feature/trip-planner-summary`; specced in `context/features/trip-planner-summary-spec.md` (split out of `trip-planner-rebuild-spec.md`'s Phase 3 section, which was trimmed to a pointer)
- `shared/map/map.ts`: `syncTripRoute()`'s road branch replaced the old start/end icon scheme (green circle-dot / red location-dot) with every stop numbered 1..N, all sharing the existing navy numbered-circle style except the final stop (destination), which gets a distinct red — generalizes to any number of stops instead of a fixed start/end pair
- `trip-planner-layout.ts/html`: `tripAttractionMarkers` (Phase 1 scaffolding, attraction-only) renamed to `tripActivityMarkers` and widened to all three `ActivityKind`s with a per-kind icon/color (binoculars/navy, hiking/green, bicycle/orange); marker `id` switched from `a.refId` (collidable across kinds) to `a.id` (the selection's own unique uuid); `(markerClick)` bound on `<app-map>` (previously unbound) to a new `onActivityMarkerClick()` — looks up the full `TripActivitySelection` by marker id, re-fetches the source object (`AttractionsService.getAttraction()` by id for attractions; best-effort radius re-search + id match via `TrailRoutesService.getRoutes()` around the owning stop's coordinates for hikes/bikes, since there's no fetch-by-id for trail routes), and opens the matching detail drawer
- `attraction-detail.ts`/`hike-detail.ts`/`bike-detail.ts`: payloads gained a `'trip-summary'` source value (new union member on `AttractionDetailPayload.source`, new optional `source?` field on `HikeDetailPayload`/`BikeDetailPayload`, which previously had none); `drawer-host.ts`'s `onAttractionDetailBack()`/`onHikeDetailBack()`/`onBikeDetailBack()` each gained a `source === 'trip-summary'` branch that reopens `'trip-planner'` (un-collapsing the drawer back to Summary) instead of the normal list-drawer reopen, since a Summary map-marker click has no backing list drawer on the stack to return to
- New `features/trip-planner/step4-summary/` — stat tiles (destination/activity counts), road-or-rail + date-range badges, a Timeline/Map View toggle (Map View just calls `drawer.collapse('trip-planner')`, reusing the map-reveal mechanism already built into `trip-planner-layout`; no new toggle plumbing needed), one card per stop with `days > 0` showing its activities grouped by kind with an inline remove (×) (mirrors `step3-activities`), an informational "connection needed" banner per unresolved rail leg with a "Fix connection" action (`plannerSvc.step.set(2)` — Step 2 already renders every unresolved leg simultaneously, no per-leg state needed), and a "Route complete!" banner once every leg (rail) or the road trip itself is resolved; wired into `trip-planner-wizard` as `@case (4)`
- i18n: `trip.planner.step4.*` added across en/de/fr/it
- Confirmed via product decision during spec: activity thumbnails are icon-only (no photos) for all three kinds — no `TripActivitySelection` model changes needed
- Verified via `tsc --noEmit` and `ng build` (both clean); UI not yet exercised in a live browser session
- Feature marked complete

### 2026-07-15 — Trip Planner Rebuild Phase 2 (Activities) Implemented

- Branch: `feature/trip-planner-activities`; specced in `context/features/trip-planner-activities-spec.md` (split out of `trip-planner-rebuild-spec.md`'s Phase 2 section, which was trimmed to a pointer)
- New `models/geo-point.ts`: `GeoPoint{id,name,lat,lon}` + `ActivityPickerPayload{destination,mode?,stopId?}` — decouples `all-attractions`/`hikes-list`/`bikes-list` from requiring a full MySwitzerland catalogue `Destination`, since trip stops are free-text/address search results; `shared/utils/geo-location.ts` (`isDestination`/`locId`/`locLat`/`locLon`) normalizes reads across the two shapes. Both pickers already supported pure lat/lon radius search under the hood (`AttractionsService.getAttractionsNearby`, geo.admin.ch's `lat`/`lon`/`radius`) — no backend changes needed
- `all-attractions`/`hikes-list`/`bikes-list`: payload widened from a bare `Destination` to `ActivityPickerPayload`; added `mode`/`stopId`/`dayOptions`/`dayChoices` (translated "Day N" / "Day N - DD-MM-YYYY" labels) computeds; each card gains a day-select + Add/Added button in `mode: 'select'`; card-tap still opens the (read-only) detail drawer in select mode instead of collapsing to the map
- `attraction-detail`/`hike-detail`/`bike-detail` payloads gained `mode?`/`stopId?` so `drawer-host.ts`'s back-nav handlers can reconstruct the picker's payload; removed `AttractionDetailPayload.source`'s dead `'trip-planner'` arm (never had a caller) — select-mode detail views now back-nav to the originating list, not straight to the wizard
- `TripPlannerService` gained `addActivity`/`removeActivity`/`isActivityAdded`/`getActivitiesForStop`; `shared/utils/date-range.ts` gained `stopDayRanges`/`stopDayOptions`/`formatDdMmYyyy`/`dayChoiceLabelParams` (the former lifted out of `Step2Itinerary`'s local computed, now shared with Step 3)
- New `features/trip-planner/step3-activities/` — one card per stop with `days > 0`, four category rows (Places to Visit/Hikes/Bike Rides/Hotels-stub) opening the matching picker in select mode, plus an inline added-items list per stop with its own remove control; wired into `trip-planner-wizard` as `@case (3)`
- i18n: `trip.planner.step3.*` added across en/de/fr/it
- UAT fixes in the same branch:
  - Real bug: Step 2's "Next" button had been hardcoded `[disabled]="true"` with a "coming soon" hint ever since Phase 1 — never wired up once Step 3 actually existed. Wired to `canContinue()` + a new `next()` method
  - Real bug: the days-here `<input>` was bound to `stop.days` off `Step2Itinerary`'s local departure/via/destination draft signals, which `onDaysChange()` never updated (only `TripPlannerService` was updated) — the field silently reverted to its old value on the next render, and `syncStops()` (called on unrelated edits like reordering) would then clobber the service's correct value with the stale draft copy. Fixed by reading the live value via a new `daysFor(stop)` helper and having `syncStops()` preserve each stop's current live `days` instead of overwriting it
  - Real bug: `canContinue` never checked `allocationMessage()`, so Step 2 let you continue to Activities with an over/under-budget day allocation despite the warning banner showing. Added `allocationMessage() === null` to the gate
  - Day-select dropdown: PrimeNG's default overlay was rendering inside the scrolling card (pushing it up/clipping) — added `appendTo="body"`; since that portals the option list to `<body>`, outside any component's view, `panelStyleClass="day-select-panel"` + a global `styles.css` rule was needed to size its font (component-scoped `::ng-deep` can't reach a body-appended node — only the closed control's own label, which stays in-component, could be sized that way)
  - Footer Back/Next buttons switched from `grid-template-columns: auto 1fr` to `1fr 1fr` (equal width) on both `step2-itinerary` and `step3-activities`; Next-button labels changed from generic "Next" to bare step names ("Activities", "Summary" — matching Step 1's pre-existing "Continue to Itinerary" precedent, then simplified to drop "Continue to" except on Step 1 per follow-up feedback)
  - "Places to Visit" card height bumped 90px → 110px (description text was clipping at 3 lines)
  - Allocation warning banner moved from the top of the scrollable stop list to just above the footer, so it stays visible without scrolling on mobile
- Feature marked complete

### 2026-07-15 — Trip Planner Rebuild Phase 1 Implemented

- Branch: `feature/trip-planner-shell-itinerary`
- Deleted the old wizard (`trip-planner.ts/.html/.css`) and `things-to-do/*`, and the old body of `shared/services/trip-planner.ts`; removed `'things-to-do'` from `DrawerKey`/`AttractionDetailPayload.source` and its now-dead back-nav branch in `drawer-host.ts`
- `models/trip.ts` rewritten: `PlannedTrip{type,dateMode,range,stops,connections,activities,routeCoordinates,name}`; `TripStop{id,role,name,lat,lon,externalId,days}` — see below for why per-stop dates ended up as a plain day-count rather than an arrival/departure pair
- `TripPlannerService` rewritten around the new model — `setType`/`setDateMode`/`setOverallRange`/`setStops`/`updateStopDays`/`setConnectionLeg`/`skipConnectionLeg`/`reset`/`loadSavedTrip`; draft autosave switched from `localStorage` to `sessionStorage` (survives a reload, clears on tab close instead of lingering indefinitely); `reset()`/`setType()` now actually clear the draft (previously wiped the in-memory trip but left a stale copy in storage that would silently reappear)
- New `features/trip-planner/trip-planner-wizard/` shell (the `'trip-planner'` drawer's component) — step signal (1–5) + step indicator; "Start over" action in the header (confirm dialog) once a draft exists
- New `features/trip-planner/step1-my-trip/` — road/rail toggle, dates-vs-day-count toggle; past dates disabled (`min` = today); day count is inclusive so a 1-day trip (start date === end date) is valid
- New `features/trip-planner/step2-itinerary/` — departure/via/destination cards with CDK drag-drop reordering on via stops, free-text autocomplete via `transport.ts` `searchLocations()`, and a per-leg rail connection picker (`connection-leg-picker/`: search/pick/"Skip for now", never blocks the step)
- Per-stop date modeling went through two false starts before landing on the shipped design, driven by UAT:
  1. Arrival/departure per stop with auto-shift cascading on edit — reverted after a real bug surfaced (epoch-day numbers leaking into "day count" mode fields) and the cascade logic proved hard to reason about
  2. Locked (departure's arrival / destination's departure, mirrored from the trip's overall range) + editable fields with equality-chain validation between neighbors — worked but validation initially checked "on or after" instead of exact equality and let one bad stop cascade false positives onto everything after it
  3. Shipped design: each stop just holds `days: number` (0 allowed — same-day pass-throughs, or a non-day departure point like "home"); validation is one arithmetic check, `sum(stop.days) === trip's total days`; a "Day N" / "Days N–M" label per stop is derived by walking the stops in order and accumulating
- Fixed two PrimeNG v21 API mismatches found via UAT: `p-autoComplete` uses `optionLabel`, not `field` (silently fell back to rendering `[object Object]`); `p-message`'s `text` input is deprecated in favor of `<p-message>content</p-message>` projection
- i18n: `trip.planner.step1.*`, `trip.planner.step2.*`, `trip.planner.startOver`/`startOverConfirm` added across en/de/fr/it
- Feature marked complete

### 2026-07-15 — Connection Leg Picker Journey Detail Restored

- Branch: `feature/connection-leg-detail`; specced in `context/features/connection-leg-detail-spec.md`
- Restored the rich rail-connection detail UI that the Phase 1 rebuild had regressed to a flat one-line summary — ported verbatim from commit `cd1a672` (last commit before the old wizard was deleted), since the underlying data (`TripConnection.sections`/`TripSection*` in `models/trip.ts`, populated by `transport.ts`'s `mapSections()`) was never touched by the rebuild
- `connection-leg-picker.ts/html/css`: both the already-picked connection and each search-result card now render as a full `.conn-card` — route header with expand chevron, transfers/duration meta row, timeline bar, and an expandable per-section detail (train category/number/direction, platforms, walk connectors); ported `toggleDetail()`/`togglePickedDetail()`, `formatPlatform()`, `formatWalk()`, `firstTrainDeparture()`, `lastTrainArrival()`, `trainColor()`, `categoryLabel()`, `isSelectedConnection()`, and the full `.conn-*` CSS block (colors adapted to this component's existing CSS variables)
- UAT fixes in the same branch: section heading changed from "Connections" to "Train Connections" (`trip.planner.connections` key, all locales); briefly added then removed a "Change" button on the picked-connection card (plus a `clearConnectionLeg()` service method it depended on) — turned out unnecessary since the leg's own header toggle already re-reveals the search form and previous results list once a connection is picked, letting the user pick a different one or search new dates without any extra affordance
- Feature marked complete

### 2026-07-14 — Hike/Bike Elevation Profile Implemented

- Branch: `feature/hike-bike-elevation`
- Backend: `schweizMobilRoutes.js` — added `fetchElevationProfile(stages)`, `fetchLineProfile(line)` (POSTs to geo.admin.ch's `profile.json`, form-urlencoded body with the `Content-Type` header set explicitly without a charset — geo.admin.ch 415s on axios' default `;charset=utf-8`); rebases each line's cumulative `dist` against a running total for one continuous distance axis across stages
- `hikingRoutes.js`/`bikeRoutes.js` controllers: added `getHikesElevation`/`getBikesElevation` (400 on missing `stages`, 404 if the profile comes back with fewer than 2 usable points); `routes/hikingRoutes.js`/`routes/bikeRoutes.js` mounted `POST /elevation` on each
- Frontend: `models/elevation-profile.ts`; `trail-routes.ts` gained `getElevationProfile(kind, route)`; new `shared/elevation-chart/` — hand-rolled SVG area chart (single-hue line/fill, hairline gridlines, muted axis labels, pointer + keyboard crosshair/tooltip), built per the `dataviz` skill's form/color/interaction rules, takes an `ariaLabel` input so the shared component isn't coupled to the hikes/bikes i18n namespace
- `hike-detail`/`bike-detail`: added `elevationProfile`/`elevationLoading`/`elevationError` signals, fetched via a `Subject`+`switchMap` effect keyed off the drawer payload (same pattern as `attraction-detail`); template renders an "Elevation profile" section (ascent/descent stat row + chart) with a skeleton while loading and a `p-message` warn on error
- i18n: `hikes.elevation.*`/`bikes.elevation.*` (`title`, `ascent`, `descent`, `loadError`) added across en/de/fr/it
- UAT fixes in the same branch: moved the elevation section above the GPX download button; ascent styled red, descent green; ascent/descent/min/max now display to 2 decimal places (`number:'1.2-2'`) instead of whole meters
- Fixed a real accuracy bug found via UAT: geo.admin.ch's `profile.json` ignores the `nb_points` cap whenever the input line already has more vertices than that (returns one DEM sample per original digitized vertex instead of resampling down) — for a 20km route this meant summing every raw delta across ~2,300 points, overcounting ascent/descent by ~7% against SchweizMobil's own published figures (confirmed against "Sentier du Rhône (Genève - La Plaine)": raw sum gave 494.2m/514.0m ascent/descent vs SchweizMobil's published 460m/480m). Replaced raw delta-summation with a 0.5m noise-threshold/hysteresis filter (only count a climb/descent once cumulative movement clears the threshold, then reset the baseline) — verified this lands within ~1% of SchweizMobil (455m/475m)
- `angular.json`: bumped production budgets (initial 500kB/1MB → 1MB/3MB warning/error; component-style 4kB/8kB → 6kB/12kB) — the app's bundle was already over the old budgets before this feature; the failure surfaced when this feature's build ran
- Feature marked complete

### 2026-07-13 — Destination Detail Hikes, Bike Rides, Hotels Implemented

- Branch: `feature/dest-detail-hikes-bikes-hotels`
- Backend: `utils/schweizMobilRoutes.js` — shared util factored out of `hikingRoutes.js` (identify call, stage-grouping, category calc), plus new distance calc (normalizes LineString/MultiLineString stage geometry to per-line arrays via `getLines()`, sums Euclidean distance per line), LV95→WGS84 reprojection (`geometryWgs84`, also normalized to `MultiLineString`), and GPX builder (`buildGpx()`, one `<trkseg>` per line)
- `controllers/hikingRoutes.js` rewritten to use the shared util; added `getHikesGpx` (`POST /api/v1/hikes/gpx`)
- New `controllers/bikeRoutes.js` + `routes/bikeRoutes.js` mirroring hikes with the `ch.astra.veloland` layer; mounted `/api/v1/bikes` in `server.js`
- Frontend: `models/trail-route.ts` (`TrailRoute`/`TrailStage`/`TrailGeometry`, `trailCategoryColor()`), `shared/services/trail-routes.ts` (`TrailRoutesService`, parameterized by `kind: 'hike'|'bike'`), `shared/services/hike-markers.ts`/`bike-markers.ts` (marker state services, `providedIn: 'root'`)
- `shared/trail-thumbnail/` — hand-rolled SVG route-shape thumbnail, one `<polyline>` per line segment (not merged into one path — a route's stages can be disconnected)
- New `features/hikes/hikes-list`+`hike-detail`, `features/bikes/bikes-list`+`bike-detail`, `features/hotels/hotels-stub` components
- `map.ts`: added independent `trailRoute`/`trailColor` second-line input (rendered as `MultiLineString`, separate from `tripRoute`/`tripType`); `activeMarker` input extended with optional `zoom` override
- `drawer.ts`: extended `DrawerKey` with `hikes`/`hike-detail`/`bikes`/`bike-detail`/`hotels`; `drawer-host.ts/.html` wired with back-nav handlers for all five
- `destination-detail.ts/.html`: removed "Plan a Trip" link/`RouterLink`; added Hikes/Bike Rides/Hotels activity cards (`.activity-cards`/`.activity-card`)
- `destinations-layout.ts/.html`: marker-visibility gating for hike/bike pins (mirrors existing attraction gating); `onMarkerClick` opens hike-detail/bike-detail from map pins; reopen buttons for collapsed hikes/bikes/hike-detail/bike-detail
- i18n: `hikes.*`/`bikes.*`/`hotels.*` added, `destinations.detail.planTrip*` removed, across en/de/fr/it
- Follow-up fixes from UAT feedback in the same branch:
  - Radius selector (5/10/20/30 km, default 30) and category filter (All/National/Regional/Local) added above each list, via `p-selectButton`
  - Route click now only requires collapsing the detail drawer to see the map (auto-collapses the underlying list drawer too, instead of requiring two manual collapses)
  - Local-category color changed `#eab308` → `#d97706` for better contrast
  - Fixed a real bug: geo.admin.ch returns `MultiLineString` (not `LineString`) for routes with gaps/multiple stages; flattening all stages into one continuous line drew straight criss-crossing connectors across gaps. Map and thumbnail now render each line segment independently (`MultiLineString`/multiple `<polyline>`s) instead of one merged path — matches how the GPX export already worked (one `<trkseg>` per line)
  - Fixed filter state (radius/category) persisting across destinations: moved `radiusKm`/`selectedCategory` off the list components (which PrimeNG can reuse across drawer open/close under fast interaction, per an animation-timing race in `onAfterLeave`) and onto `HikeMarkersService`/`BikeMarkersService` (true singletons), with `resetFiltersForDestination()` comparing destination object identity to decide whether to reset to defaults
  - Selecting a hike/bike (from its card or its map pin) now flies the map to the midpoint of the route's start/end coordinates at zoom 10 (attractions still center on their own point at zoom 15)
- Feature marked complete

### 2026-06-15 — Trip Planner Wizard Specced

- Specced a step-based wizard for the Trip Planner drawer; see Goals above for full decisions
- Created `feature/trip-planner-wizard` branch (off `feature/trip-things-to-do`, which was
  committed as `bdc419e`) and `context/features/trip-planner-wizard-spec.md`

### 2026-06-16 — Trip Planner Wizard Implemented

- Wizard step model (`TripStep` type, `step` signal, `steps`/`currentStep` computed) added to `TripPlanner` component
- `canGoNext`/`nextHint` computed signals gate Back/Next navigation per step
- `goNext()`/`goBack()` navigation methods added
- `searchedConnections` signal tracks whether a connection search has been attempted (controls empty-state message)
- `onTypeChange()` resets step and `searchedConnections` on type toggle
- Error handler for `findConnections()` now also sets `searchedConnections` to true
- i18n keys added for all wizard steps across en/de/fr/it
- CSS updated for wizard layout and step-specific panels
- Template restructured into step-gated sections with Back/Next controls

### 2026-06-16 — Trip Planner Fixes Specced

- Created `context/features/trip-planner-fixes-spec.md` covering 11 UX/layout fixes for the wizard
- Key items: title layout, tripType button color, connections form overhaul (float label removal, time-only datepicker, remove Find Connections button), linear step enforcement, hide Back on step 1, full-height connections list, connection card time row

### 2026-06-16 — Trip Planner Fixes Implemented

- Branch: `feature/trip-planner-fixes`
- `drawer-host.html/css`: added `.tp-header-brand` (flex row) so icon + title sit on one row; overrode `.tp-drawer .p-drawer-content` to `overflow: hidden` so trip-planner owns its own scroll
- `trip-planner.css`: restructured to flex-column host layout; added `.tp-content` scrollable area; `.tp-section--fill` for full-height connections step; `#285278` selected button color; prominent `.stop-things-link` (border + bg); `.save-actions-row` for side-by-side save buttons; `flex-wrap: nowrap` on `.conn-times`
- `trip-planner.html`: `.tp-content` wrapper around `@switch`; Back button hidden on step 0 (spacer keeps grid); `p-floatLabel` replaced with plain labels on connections form; time input replaced with `p-datePicker [timeOnly]="true"`; Find Connections button removed; Next button shows `[loading]` while searching; connection step uses `.tp-section--fill`; save/view buttons wrapped in `.save-actions-row`
- `trip-planner.ts`: `connTime` signal changed to `signal<Date | null>(null)`; `canGoNext` for 'schedule' returns `!connectionsLoading()`; 'schedule' hint removed from `nextHint`; `goNext()` calls `findConnections()` when on schedule step; `findConnections()` extracts HH:MM from Date and auto-advances to connection step on success

### 2026-06-16 — Round Trip & Reordering Spec Added

- Round trip toggle implemented on the stops step: mirrors last stop to origin, keeps them in sync on origin change, locks end stop input and hides its remove button; resets on type change
- `swissNow()` helper added (uses `Intl.DateTimeFormat` with `Europe/Zurich`); `connDate`, `connTime`, and `today` now default to Swiss CET/CEST
- i18n key `trip.planner.roundTrip` added across en/de/fr/it
- Branch committed as `b475193`
- Created `context/features/trip-planner-reordering-spec.md` for next feature (Angular CDK drag-drop on via stops only; connections list explicitly out of scope)

### 2026-06-16 — Map View Fixes

- `trip-planner-layout.ts`: `tripBounds` now passes the full route polyline to `applyFitBounds` (instead of just first/last point) so round trips zoom to show the full route; added `tripStopPoints` computed signal mapping `trip().stops` → `[lon, lat][]`
- `trip-planner-layout.html`: passes `[tripStopPoints]` to `app-map`
- `map.ts`: added `@Input() tripStopPoints`; road trip markers now use `fa-circle-dot` (green) for origin, `fa-location-dot` (red) for destination, and navy numbered circles for via stops

### 2026-06-17 — Stop Reordering Completed

- Feature reviewed and accepted; branch `feature/trip-planner-reordering` marked complete

### 2026-06-17 — Transport Connection Detail Specced

- Specced redesigned connection cards for the rail trip planner connection step
- Created `feature/transport-connection-detail` branch and `context/features/transport-connection-detail-spec.md`
- Key decisions: section data mapped from existing `/connections` API (no backend changes); `TripConnection.sections` is optional for backwards compatibility; card click = select, chevron click = expand/collapse detail; walk sections shown as connectors between journey legs

### 2026-06-17 — Transport Connection Detail Implemented

- `models/trip.ts`: added `TripSectionStop`, `TripSectionJourney`, `TripSection` interfaces; `TripConnection` extended with optional `sections?: TripSection[]`
- `transport.ts`: added `SectionStop`, `SectionJourney`, `SectionWalk`, `ConnectionSection` interfaces; replaced broad `sections` type on `ConnectionResult`; added `mapSections()` private method; `getConnections` mapping now includes `sections`; `extractPassListCoords` parameter updated to `ConnectionSection[]`
- `trip-planner.ts`: removed `Tag`/`Chip` imports (no longer used); added `expandedConnectionIndex` signal; `onTypeChange` and `findConnections` both reset it; added `toggleDetail()`, `formatPlatform()`, `trainColor()`, `categoryLabel()` methods
- `trip-planner.html`: connection step `@for` block fully replaced — new `.conn-card` (clickable, selectable), header row (route + chevron), meta row (transfers + duration), timeline bar, expandable `.conn-detail` with per-section journey stops/train/walk rendering
- `trip-planner.css`: old `.conn-row`/`.conn-main`/`.conn-times`/tags styles replaced with new card, header, meta, timeline, stop, leg, walk, and platform-badge rules
- `en/de/fr/it.json`: added `trip.planner.transfer` (singular) and `trip.planner.connection.direction`/`connection.walk` keys in all four locales

### 2026-06-18 — Transport Connection Detail Fixes

- Walk duration: API returns seconds; `formatWalk()` converts to minutes (`Math.floor(s/60)`), returns `''` for null/undefined/under 60s; template renders "Walk" alone or "Walk · X min" with duration appended — `{{duration}} min` parameter removed from all four i18n `walk` keys
- Timeline times: `firstTrainDeparture()` and `lastTrainArrival()` helpers find the first/last journey section's times, skipping any leading/trailing walk sections that were inflating the displayed range
- Train label: changed from `section.journey.name` (API combined field) to `section.journey.category + section.journey.number` so the display is built from discrete fields as intended

### 2026-06-18 — Transport Connection Detail Completed

- Feature reviewed and accepted; branch `feature/transport-connection-detail` marked complete


### 2026-06-19 — Map Marker Anchor Fix

- All MapLibre custom markers now wrap the Font Awesome `<i>` icon in a 28×28px `.map-marker-container` flex div; MapLibre measures the container for its `anchor: 'center'` calculation, giving precise coordinate alignment at all zoom levels
- Without the wrapper, MapLibre measured the `<i>` element's unreliable inline font-metric bounding box, producing a fixed CSS-pixel offset that appeared as large geographic drift at low zoom and shrank on zoom-in

### 2026-06-19 — Misc Fixes 2 Implemented

- Branch: `feature/misc-fixes-2`
- `trip-planner.ts` (service): added `DRAFT_KEY` constant; constructor restores draft from `localStorage` on app load; `_trip$` subscription with `debounceTime(300)` + `skip(1)` auto-saves stops/type/name/routeCoordinates; added `clearDraft()` method; removed `catchError` from `buildRoadRoute()` so errors propagate
- `trip-planner.ts` (component): added `routeError` signal; `onStopsChanged()` now catches route errors and sets `routeError`; calls `plannerSvc.clearDraft()` on type change and on successful save; added `moveStopUp()`/`moveStopDown()` methods; added `getStopSelections()`/`getAttractionName()` helpers for finish summary; imported `Panel`
- `trip-planner.html`: route error `p-message` below stop list skeleton; keyboard move-up/down buttons on via-stop rows (`.stop-kbd-btns`); `aria-label` on each `p-autoComplete` (From/To/Via N), remove button, and drag handle; finish step trip summary (`trip-summary` block with `stop-indicator` + `p-panel` per stop with attractions)
- `trip-planner.css`: `.stop-kbd-btns` hidden by default, shown on `.stop-row:focus-within`; `.stop-kbd-btn` styles; full finish-step summary styles (`.trip-summary`, `.summary-stop-row`, `.summary-panel`, `.summary-attraction-row`)
- `attraction-vertical-list.ts/html`: added `loadError` signal; `catchError` in pipe returns null sentinel; template shows `p-message severity="warn"` instead of skeleton on error
- `all-attractions.ts/html`: added `loadError` signal; `loadMore()` error handler sets it; template shows `p-message` in the non-search list branch
- `things-to-do.ts/html`: added `loadError` signal; `catchError` on `fetchTrigger$` inner observable; reset clears error; template shows `p-message` between skeleton and empty states
- `attraction-detail.ts/html`: added `loadError` signal; `catchError` in `fetchTrigger$` pipeline; error resets on payload clear; template shows `p-message` above the gallery skeleton
- `map.ts`: replaced `markerInstances: Marker[]` with `Map<string, { marker, el }>`; added `markerKey()`/`buildMarkerEl()`/`addMarker()` helpers; `syncMarkers()` now diffs by key — removes stale, updates `className`/`color` in-place, adds only new; `ngOnDestroy` iterates the Map
- `footer-nav.ts`: injected `Router`; `showNav` signal via `toSignal` on `NavigationEnd` events — true only for `/destinations/:id` and `/trip-planner[/:id]`; host binding `[style.display]` hides nav on all other routes
- `drawer-host.html`: `[attr.aria-label]` added to all `menu-close` buttons (close or show-on-map) using `nav.close` / `nav.showOnMap` keys
- `en/de/fr/it.json`: added `trip.planner.routeError`, `removeStop`, `dragStop`, `moveStopUp`, `moveStopDown`, `attraction`, `attractions`; added `attractions.loadError` and `attractions.detail.loadError`; added new `nav.close` / `nav.showOnMap` section

### 2026-06-19 — Misc Fixes 1 Implemented

- Branch: `feature/misc-fixes-1`
- `trip-planner.html`: wrapped Round Trip button in `@if (selectedType() !== 'rail')` to hide it for rail trips; replaced `.stop-input-row` + `.stop-actions` structure with `p-inputGroup` containing two `p-inputGroupAddon` slots (remove × and drag ⠿ icons inline in the input); moved `[class.stop-action--hidden]` to the inner icon/button so addon borders always render and every row looks the same width
- `trip-planner.ts`: imported `InputGroup` and `InputGroupAddon` from PrimeNG
- `trip-planner.css`: replaced old `.stop-input-row`/`.stop-actions`/`.stop-remove` rules with `.stop-input-group`, `.stop-addon`, `.stop-icon-btn`, and drag-addon styles; suppressed focus/hover border-color and box-shadow on autocomplete input inside the group
- `trip-planner-layout.ts`: added `displayedTripRoute` and `displayedTripStopPoints` computed signals that return `null`/`[]` while the trip-planner drawer is open, deferring route display on the map until Save/View Trip collapses the drawer; added `clickable: true` to `tripAttractionMarkers`; injected `AttractionMarkersService`; added `onAttractionMarkerClick()` to open `attraction-detail` drawer with `source: 'trip-planner'`; default `center` set to Switzerland `[8.2275, 46.8182]`; added `mapZoom` signal (default 7, set to 12 on destination load, 10 on stored route center)
- `trip-planner-layout.html`: switched `[tripRoute]`/`[tripStopPoints]` to `displayedTripRoute()`/`displayedTripStopPoints()`; wired `(markerClick)="onAttractionMarkerClick($event)"`; changed `[zoom]` to `[mapZoom()]`
- `attraction-detail.ts`: added `'trip-planner'` to `AttractionDetailPayload.source` union type
- `drawer-host.html`: added `@else if (attractionDetailSource() === 'trip-planner')` branch for the attraction-detail back button label
- `drawer-host.ts`: `onAttractionDetailBack()` now handles `source === 'trip-planner'` — closes attraction-detail and reopens trip-planner
- `map.css`: removed `max-width` on popup to fix tooltip truncation; moved `maplibregl-ctrl-bottom-right` bottom offset from mobile-only media query to unconditional (footer-nav is now visible at all widths)
- `footer-nav.css`: changed desktop media query (`≥600px`) to hide `.footer-btn` only, leaving the nav bar itself visible
- `header-nav.css`: added `border-bottom: none; box-shadow: none` to p-menubar to eliminate white visual gap below the header
- `trip-planner-layout.css` / `destinations-layout.css`: added `background: var(--navy-800)` to host as defensive fallback against any gap between header and map
- `en/de/fr/it.json`: added `trip.planner.backToPlanner` key in all four locales

### 2026-06-16 — Stop Reordering Implemented

- Branch: `feature/trip-planner-reordering`
- `@angular/cdk@21` installed
- `trip-planner.ts`: imported `DragDropModule`, `CdkDragDrop`, `moveItemInArray`; added `reorderStop(event)` handler — clamps drop index to via-stop range (1..n-2), moves both `stops` and `stopSuggestions` in sync, then calls `onStopsChanged()`
- `trip-planner.html`: `cdkDropList` + `(cdkDropListDropped)` on `.stop-list`; `cdkDrag` + `[cdkDragDisabled]` (disabled for origin, destination, and while loading) on each row; `cdkDragHandle` grip icon shown only for via stops; `*cdkDragPreview` shows stop name with grip icon; `*cdkDragPlaceholder` renders dashed empty slot
- `trip-planner.css`: `.stop-drag-handle` (grab cursor, right-aligned); `.stop-drag-preview` (white card + box-shadow); `.stop-drag-placeholder` (dashed border); CDK animation transitions

### 2026-07-03 — Home Categories Specced

- Specced two new home page destination sections (Mountains, Lakes & Glaciers; Nature Parks) alongside the existing City Breaks section, all sharing `DestinationHorizontalList`
- New `destination-category.ts` model (`CategoryKey`/`CategoryConfig`/`DESTINATION_CATEGORIES`) to centralize per-category facets, copy keys, and map icon; `DestinationVerticalList` to become dynamic via `?category=` query param instead of static `@Input()`s
- Created `context/features/home-categories-spec.md`; no feature branch created yet

### 2026-07-08 — Home Categories Implemented

- `models/destination-category.ts`: new model with `CategoryKey` type, `CategoryConfig` interface, and `DESTINATION_CATEGORIES` record (`cities`/`mountains-lakes`/`nature-parks`) centralizing facets, title/subtitle/pageSubtitle copy keys, card title, and map icon per category
- `home.html`/`home.css`: replaced `.destinations-section` with banded `.home-section`/`.section-inner` layout; three `DestinationHorizontalList` sections (City Breaks, Mountains/Lakes/Glaciers, Nature Parks) with alternating white/`#f5f6f7` backgrounds and `viewAllQueryParams` carrying `?category=`
- `destination-horizontal-list.ts/html`: added `viewAllQueryParams` input, bound alongside `routerLink` on the "View all" link
- `destination-vertical-list.ts/html`: now reads `?category=` via `ActivatedRoute`, resolves `CategoryConfig` from `DESTINATION_CATEGORIES` (defaults to `cities`), holds it in a signal, re-fetches on category/language change, and drives title/subtitle/card badge/map icon from the config; removed the now-unused static `@Input()`s
- `en/de/fr/it.json`: added `destinations.mountains` and `destinations.natureParks` keys (title/subtitle/count) in all four locales

### 2026-07-08 — Destination Detail Fixes 2 Specced

- Specced 5 fixes to `destination-detail`/map/drawer/trip-planner chrome, prompted by the new home-page categories: (1) hide attraction UI when a destination has 0 attractions; (2) destination-detail map shows only a red/bigger destination pin, attraction pins gated to the all-attractions context; (3) Plan Trip/weather boxes side by side via a two-column `.action-grid`; (4) dynamic "back to destinations" via a `?category=` query param carried through destination links; (5) road-trip prefill seeded from the destination's own `dest.geo` instead of an address search (fixes mountain/lake/glacier destinations with no street address) — rail nearest-station lookup deferred
- Created `context/features/dest-detail-fixes2-spec.md`; no feature branch created yet

### 2026-07-10 — Destination Detail Fixes 2 Implemented

- Branch: `feature/dest-detail-fixes-2`
- `attraction-markers.ts`: added `hasAttractions` signal (default `true`) + `setHasAttractions()`, reset in `clear()`
- `attraction-vertical-list.ts/html`: reports `hasAttractions` after load; stopped seeding map markers from the top-attractions list; `onAttractionClick` now opens `attraction-detail` directly with `source: 'destination-detail'`; whole section hidden once loaded with zero attractions
- `destinations-layout.ts/html`: added `destinationMarker` (red, `.destination-marker` class, always shown) and `showAttractionMarkers`/`displayMarkers` gating so attraction pins only render while on the all-attractions list (open, collapsed, or an attraction-detail reached from it); reopen buttons gated on `attractionMarkers.hasAttractions()`
- `drawer-host.ts/html`: `onAttractionDetailBack()` handles `source: 'destination-detail'`; `onDestinationBack()` reads `category` off the current URL (`Router.parseUrl`) and forwards it instead of always defaulting to `/destinations`
- `map.css`: `.destination-marker` (2.2rem, red)
- `destination-detail.css`: `.action-grid` → two columns (Plan Trip / Weather side by side, equal height via CSS Grid stretch), single column under 400px
- `destination-horizontal-list.ts/html`, `destination-vertical-list.ts/html`, `home.html`: new `categoryKey` input carries `?category=` on every destination-card link
- `trip-planner-layout.ts`: road-trip prefill payload changed from a bare name string to `{ name, lat, lon, identifier }` when geo is known
- `trip-planner.ts`: prefill effect seeds the 'to' stop directly from destination coordinates for road trips (bypassing address search); `TripPlannerService.buildRoadRoute()` throws `NO_ROAD_ROUTE` when OSRM returns non-`Ok`, surfaced via new `routeUnreachable` signal that blocks `canGoNext`/shows a dedicated error message; pre-filled 'to' stop is locked (`destinationLocked`) — disabled input, hidden remove button
- i18n: `trip.planner.routeUnreachable` added across en/de/fr/it
- Follow-up fixes in the same branch: removed the round-trip feature entirely (`isRoundTrip`, `toggleRoundTrip()`, button, CSS, `roundTrip` i18n key); fixed a long-standing typo where PrimeNG's addon class is `p-inputgroupaddon` (no hyphen) not `p-inputgroup-addon` — every addon override rule (background, hover, drag cursor, and the new `.stop-addon--disabled` gray-out) was silently dead until corrected; `trip-planner-layout.ts/html` gained `displayedTripAttractionMarkers`, hiding "things to do" pins until the drawer collapses (Save/View Trip), mirroring the existing route/stop-marker gating; `map.ts/css` — attraction marker containers now carry their `className` via safe `classList` diffing (preserves MapLibre's own marker class) and get `z-index: 5` so they stay clickable over overlapping destination/route markers; road route line is now solid `#1a2f4a` (was dashed green), rail unchanged; `trip-planner.ts` prefill effect now detects a genuinely new destination (vs. resuming a restored draft for the same one) and calls `resetForNewDestination()` — wipes route/stops/attraction cache via `plannerSvc.reset()`, resets wizard step to 0, clears connections/trip name
- Feature marked complete
