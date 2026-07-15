# Destination Activities + Trip Planner Rebuild

## Overview

Two connected changes:

1. **Destination detail** gains three new side drawers — Hikes, Bike Rides, Hotels — alongside the existing Weather and Attractions. The "Plan a Trip" link is removed from destination-detail entirely (trip planning becomes its own top-level entry point, not something launched from a specific destination).
2. **Trip Planner** is fully rebuilt as a 5-step wizard: **1 My Trip → 2 Itinerary (+ rail connections sub-phase) → 3 Activities → 4 Summary → 5 Save Trip**. The old stop-list/schedule/connection/finish wizard, its service, its data model, and the `things-to-do` drawer are removed and replaced — not preserved for backwards compatibility. Old saved trips in MongoDB are not migrated.

This is one spec covering the full vision, implemented across 5 phased feature branches (see History below for per-phase implementation logs). Reasoning for scope/UX decisions and open questions raised during specification are captured inline per section.

**On visual design**: `context/screenshots/My Trip.png`, `Itinerary.png`, `Activities.png`, `Places to visit.png`, `Bike rides.png`, `Save Trip.png` illustrate the intended **user journey** (step order, what each step asks for, the general shape of drawer-based activity pickers) — they are not a pixel-level design spec. Exact colors, icon choices, card layout, copy, and componentry are implementation details to be worked out during each phase, consistent with the app's existing PrimeNG/Tailwind/dark-mode-first conventions (`context/coding-standards.md`), not dictated by the mockups. Where this spec below describes a specific color or icon, treat it as one reasonable option illustrating intent, not a requirement.

## Confirmed decisions

- Hikes/Bike-Rides drawers are **view-only** when opened from destination-detail (Phase 0); a "select for day X" mode is added in Phase 2 when opened from the trip planner's Activities step.
- Hotels drawer ships as an **empty stub** (header + "coming soon"). No backend, no MySwitzerland/Booking.com integration in this rebuild — flagged as a future phase once the rest of the app is showcased and partner API access is pursued.
- Trip Planner Step 2 stop locations stay **free-text address/station search** (today's autocomplete via `TransportService.searchLocations`), not restricted to the curated MySwitzerland destination catalogue.
- **Rail trips keep real connection lookup** — one connection per leg (Departure→Stop1, Stop1→Stop2, …), picked as a sub-phase within Step 2 (not a separate top-level wizard step). The selected schedule persists with the trip so it can be looked up again later.
  - Connection search needs a concrete date and time. Every leg always prompts for both, regardless of whether Step 1 used "Specific Dates" or "Number of Days" — in Dates mode the date field pre-fills from the stop's Arrival/Departure boundary as a default but remains editable; in Days mode there's no real date yet, so the user picks one from scratch.
  - Each leg has a **"Skip for now"** action. Step 2 is never blocked by unresolved legs. Step 4 (Summary) surfaces a "Connection needed" notice per unresolved leg with a jump-back action into that leg's picker. Saving (Step 5) is allowed with unresolved connections — the trip saves as-is and can be reopened later to finish picking them.
- Itinerary order is fixed: Departure is always first, Destination is always last, additional stops are reorderable only in between.
- Date/day ranges across stops are **contiguous and forward-consuming** — no gaps, no overlap. Editing an earlier stop's range **auto-shifts** later stops to stay contiguous, with a visible "dates shifted" notice.
- Old Mongoose `Trip` schema is fully replaced; no migration of existing saved trips.
- Footer nav: the dead `/explore` link is replaced with a "Trip Planner" entry pointing at `/trip-planner`.
- Hike/bike cards show **no photos and no difficulty/duration/elevation**. Confirmed via `backend/src/controllers/hikingRoutes.js` (`geometryFormat=geojson`, `sr=2056`) that geo.admin.ch's Wanderland/Veloland geometry is 2D (easting/northing only, no Z) — elevation would require a separate per-route DEM/profile query, out of scope. Cards show name, category (national/regional/local, derived from route number), distance (derived from geometry), and a generated route-shape image — the route's LineString rendered as a line drawing over a generic background (not a live map tile, not a stock photo).

## Architecture being reused (not rebuilt)

- **Drawer stack**: `frontend/src/app/shared/services/drawer.ts` (`Drawer`, `DrawerKey` union, `stack`/`collapsedKeys` signals, `payloads: Map<DrawerKey, any>`) + always-mounted `frontend/src/app/shared/drawer-host/drawer-host.ts/.html`. New drawers register a `DrawerKey`, a component, and a back-nav handler, mirroring `all-attractions`/`attraction-detail`.
- **External API proxy pattern**: frontend service → `${environment.apiUrl}/api/v1/...` → Express controller (server-side API key) → `cacheResponse()` Redis middleware (`backend/src/middleware/cache.js`). Mirrors `myswitzerland.js`/`attractions.ts`.
- **Hikes backend already exists**: `GET /api/v1/hikes?lat=&lon=&radius=` (`backend/src/controllers/hikingRoutes.js`, `routes/hikingRoutes.js`, `middleware/lv95Converter.js`), pulling `ch.astra.wanderland` from geo.admin.ch, grouping stages into routes, already deriving `category` from `chmobil_route_number` digit-count. Bike rides reuse the identical pattern with layer `ch.astra.veloland`.
- **Map**: `frontend/src/app/shared/map/map.ts` — `MapMarker{lng,lat,label?,icon?,color?,className?,id?,highlight?,clickable?}` diffed by id; popups with an optional clickable button emit `markerClick`; `tripRoute`/`tripType`/`tripStopPoints`/`fitBounds` inputs draw a road/rail route line + numbered stop markers. Marker-state pattern to mirror: `attraction-markers.ts`.
- **i18n**: locale files at `frontend/public/i18n/{en,de,fr,it}.json`.

## Data model (`frontend/src/app/models/trip.ts`, fully rewritten)

```ts
export type TripDateMode = 'dates' | 'days';

export interface TripDateRange {
  mode: TripDateMode;
  startDate?: string;  // ISO yyyy-mm-dd, mode === 'dates'
  endDate?: string;
  startDay?: number;   // 1-based relative day, mode === 'days'
  endDay?: number;
}

export interface TripStop {
  id: string;                      // client-generated uuid
  role: 'departure' | 'destination' | 'stop';
  name: string;
  lat: number;
  lon: number;
  externalId?: string;              // present if picked via rail station search
  range: TripDateRange;             // contiguous with neighboring stops; within trip.range
}

// Rail-only: one connection per leg between consecutive stops
export interface TripConnectionLeg {
  fromStopId: string;
  toStopId: string;
  connection: TripConnection;       // reuse existing TripConnection/TripSection* shapes as-is
}

export type ActivityKind = 'attraction' | 'hike' | 'bike';

export interface TripActivitySelection {
  id: string;
  stopId: string;
  kind: ActivityKind;
  refId: string;
  day: string | number;             // ISO date or relative day #, within the stop's range
  name: string;
  lat?: number; lon?: number;
  distanceKm?: number;               // hike/bike only
  category?: 'national' | 'regional' | 'local';
}

export interface PlannedTrip {
  type: 'road' | 'rail';
  dateMode: TripDateMode;
  range: TripDateRange;              // Step 1's overall range
  stops: TripStop[];                 // Step 2's ordered itinerary
  connections?: TripConnectionLeg[]; // rail only, Step 2 sub-phase
  activities: TripActivitySelection[]; // Step 3
  routeCoordinates?: [number, number][];
  name?: string;
}

export interface SavedTrip extends PlannedTrip {
  _id?: string;
  createdAt?: string;
}
```

`TripConnection`/`TripSection`/`TripSectionStop`/`TripSectionJourney` are kept as-is (rail connections stay, generalized from one-per-trip to one-per-leg).

## Phase 0 — Destination Detail: Hikes, Bike Rides, Hotels

### Backend
- Extract shared logic from `hikingRoutes.js` into `backend/src/utils/schweizMobilRoutes.js`: identify call + stage-grouping + category calc (already exists, factor it out), plus new distance calc (sum Euclidean distance between consecutive LineString vertices, already in LV95 meters) → `distanceKm`/`distanceMiles`. Reproject each route's geometry LV95→WGS84 backend-side (via `proj4`) → `geometryWgs84`, alongside raw `geometry`.
- `hikingRoutes.js`: add `distanceKm`/`distanceMiles`/`geometryWgs84` via the shared util; add a GPX export handler.
- New `bikeRoutes.js` controller + route: identical to hikes, layer swapped to `ch.astra.veloland`.
- New `POST /api/v1/hikes/gpx` and `POST /api/v1/bikes/gpx` — JSON body `{ name, stages }`, inverse-project LV95→WGS84, return `application/gpx+xml` with `Content-Disposition: attachment`.
- Mount `/api/v1/bikes` in `server.js`.

### Frontend
- `models/trail-route.ts` — shared `TrailRoute`/`TrailRoutesResponse` shape for hikes and bikes.
- `shared/services/trail-routes.ts` (`TrailRoutesService`) — parameterized by `kind: 'hike'|'bike'`.
- `shared/services/hike-markers.ts` and `bike-markers.ts` — independent marker-state services (both drawers can be on the stack simultaneously).
- `shared/trail-thumbnail/trail-thumbnail.ts` — normalizes a route's LineString to an SVG viewBox, polyline colored red/blue/yellow by category, rendered over a generic background.
- New components: `features/hikes/hikes-list/`, `hikes/hike-detail/`, `features/bikes/bikes-list/`, `bikes/bike-detail/`, `features/hotels/hotels-stub/` (empty "coming soon" state).
- `map.ts`: independent second route-line input pair — `@Input() trailRoute`/`trailColor` — via a second GeoJSON source/layer, kept separate from `tripRoute`/`tripType` so a hike/bike preview can coexist with a planned-trip route later.
- `drawer.ts`: extend `DrawerKey` with `'hikes' | 'hike-detail' | 'bikes' | 'bike-detail' | 'hotels'`.
- `drawer-host.ts/.html`: register the 5 new components + back-nav handlers.
- `destination-detail.ts/.html`: remove "Plan a Trip" link/anchor + `RouterLink` import; add Hikes/Bike Rides/Hotels link cards.
- `destinations-layout.ts`: extend marker-visibility gating for hike/bike markers.
- i18n: add `hikes.*`, `bikes.*`, `hotels.*`; remove `destinations.detail.planTrip*`; add `destinations.detail.hikes/bikeRides/hotels`.

## Phase 1 — Trip Planner shell + Step 1 (My Trip) + Step 2 (Itinerary + rail connections)

### Deletions
- `features/trip-planner/trip-planner.ts/.html/.css` (old wizard body)
- `features/trip-planner/things-to-do/*` (only caller deleted; superseded by Phase 2's per-day model)
- Old body of `shared/services/trip-planner.ts` (rewritten; OSRM call + localStorage-autosave-draft pattern salvaged)
- `'things-to-do'` from `DrawerKey` (`shared/services/drawer.ts`) and its registration/back-nav wiring in `drawer-host.ts/.html`
- `'things-to-do'` from `AttractionDetailPayload.source` (`features/attractions/attraction-detail/attraction-detail.ts`) and the corresponding branch in `drawer-host.ts`'s `onAttractionDetailBack()` — dead once the drawer it points at is gone. Phase 2 introduces whatever new source value its select-mode picker needs.

### Kept / modified
- `shared/services/transport.ts` / `backend/.../transport.js`: `searchLocations()` reused as-is for Step 2's free-text stop search. `getConnections`/`getConnectionJourneys` reused as-is, called once per leg.
- `shell/trip-planner-layout/`: kept as the routed (`/trip-planner`, `/trip-planner/:id`) map-owning shell; keeps the "hide route/markers while drawer open, reveal on collapse" pattern (Step 4 plays the old finish-step's role).
- `app.routes.ts`: unchanged.

### New
- `shared/services/trip-planner.ts` (rewritten): `setType`, `setDateMode`, `setOverallRange`, `addStop`/`updateStop`/`removeStop`/`reorderStops`, `computeAvailableRangeForStop(index)` (contiguous allocation), auto-shift-on-edit propagation + "dates shifted" flag, `setConnectionLeg()`, draft autosave, `reset()`, `loadSavedTrip()`.
- `features/trip-planner/trip-planner-wizard/` — new shell (`'trip-planner'` drawer), owns `step` signal (1–5) + step indicator.
- `features/trip-planner/step1-my-trip/` — road/rail toggle, date-range vs. day-count mode toggle.
- `features/trip-planner/step2-itinerary/` — ordered stop list (departure fixed first, destination fixed last, via-stops reorderable via CDK drag-drop), free-text autocomplete, per-stop range picker constrained by `computeAvailableRangeForStop`. For rail trips, an inline sub-view iterates consecutive stop pairs; each leg prompts for date + time, then calls `getConnections`, letting the user pick a connection or Skip for now.
  - Functional shape (visual design open): the overall trip range should stay visible for reference while building the itinerary; each stop needs its position in the itinerary clear at a glance (numbered / departure vs. final-destination distinguishable) and its own arrival/departure date fields; adding a stop should feel lightweight (inline, not a full modal) — exact layout/styling TBD during implementation.
- i18n: reuse existing `trip.planner.typeRoad/typeRail/addStop/removeStop/dragStop`; add `tripPlanner.step1.*`, `tripPlanner.step2.*` (`departure`, `destination`, `stop`, `dateRangeLabel`, `dayRangeLabel`, `datesShifted`, `legOf`, `pickConnection`).

## Phase 2 — Step 3 (Activities)

### Confirmed decisions (this phase)
- Tapping an activity card in select mode opens its full detail drawer (photo/description, same as today's view-mode behavior) — view-only, no Add control there. Closing detail returns to the picker list it came from (not straight back to the wizard), so Add always happens from the list card itself.
- Each attraction/hike/bike can be added to a given stop **once** — the Add button becomes a terminal "Added" state per stop (not per-day-repeatable). Re-tapping "Added" removes it.
- Removal is available both from the picker list (Step 3, via the "Added" toggle) and from the stop's own inline added-items list in Step 3, and again from Step 4 (Summary) — not Step-3-only.
- Stops with `days === 0` (same-day pass-throughs, or a non-day departure point like "home") show no activity pickers at all — there's no day to assign an activity to.

### Architecture: decoupling the activity pickers from the MySwitzerland catalogue
`all-attractions`/`hikes-list`/`bikes-list` currently require a full MySwitzerland `Destination` (`models/destination.ts`) — nested `geo.latitude`/`geo.longitude`, `identifier`, `abstract`, `photo`, etc — because every existing caller (`destination-detail`, `attraction-vertical-list`, `destinations-layout`) already holds one. Trip Planner stops (`TripStop`) are free-text address/station search results per Phase 1 — flat `lat`/`lon`, no MySwitzerland `identifier`, no catalogue metadata.

All three pickers already query by radius off plain coordinates under the hood — `AttractionsService.getAttractionsNearby(lat, lon, ...)` builds `geo.dist=lat,lon,radiusMeters`, and hikes/bikes call geo.admin.ch by `lat`/`lon`/`radius` directly (Phase 0) — the coordinate is just currently sourced from `dest.geo.latitude`/`dest.geo.longitude`. No new backend capability is needed, only decoupling the existing radius query from requiring a full catalogue object to carry the coordinate.

New minimal type (`models/geo-point.ts`):
```ts
export interface GeoPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
}
```
`all-attractions.ts`, `hikes-list.ts`, `bikes-list.ts`: widen their destination payload field to `Destination | GeoPoint`; normalize the handful of read sites (dedup-by-id effect, `geo.latitude`/`geo.longitude` radius-fetch call) to read through a flat lat/lon/id accessor that works for either shape, instead of assuming a nested `.geo`. `attraction-detail`/`hike-detail`/`bike-detail` get the same widening on their `destination`/origin field (used only for back-nav + breadcrumb text there, never re-fetched by identifier).

### Data model / service
`models/trip.ts` already has `ActivityKind`/`TripActivitySelection`/`PlannedTrip.activities` from Phase 1, unused until now — no model changes needed.

`shared/services/trip-planner.ts` (`TripPlannerService`) gains:
```ts
addActivity(selection: Omit<TripActivitySelection, 'id'>): void
removeActivity(activityId: string): void
isActivityAdded(stopId: string, kind: ActivityKind, refId: string): boolean
getActivitiesForStop(stopId: string): TripActivitySelection[]
```
All mutators go through the existing `_trip$`/autosave pipeline, same as `updateStopDays`.

`shared/utils/date-range.ts` gains a day-range utility, generalized out of `Step2Itinerary`'s local `stopDayLabels` computed (today's only place that turns `TripStop.days` counts into concrete day numbers):
```ts
export function stopDayRanges(stops: TripStop[]): Map<string, { start: number; end: number }>
export function stopDayOptions(trip: PlannedTrip, stopId: string): (string | number)[]
```
`stopDayOptions` converts a stop's `{start, end}` range into concrete values a day-picker dropdown can offer: integers in `days` mode, ISO date strings (`trip.range.startDate` + offset) in `dates` mode. `Step2Itinerary` is refactored to call `stopDayRanges()` instead of its local computed — no behavior change there.

### Drawer payload changes
`all-attractions`/`hikes`/`bikes` payloads become wrapped objects instead of a bare `Destination`:
```ts
export interface ActivityPickerPayload {
  destination: Destination | GeoPoint;
  mode?: 'view' | 'select';   // default 'view'
  stopId?: string;             // set when mode === 'select'
}
```
Every existing `drawerSvc.open('all-attractions'|'hikes'|'bikes', destination)` call site updates to `.open(key, { destination })` — `mode` omitted defaults to `'view'`, so existing behavior is unchanged.

`AttractionDetailPayload`/`HikeDetailPayload`/`BikeDetailPayload` gain `mode?`/`stopId?` so back-nav can reconstruct the picker's payload on the way back. `AttractionDetailPayload.source`'s existing-but-unused `'trip-planner'` value is removed — select-mode card taps keep `source: 'all-attractions'`, and `onAttractionDetailBack()`/`onHikeDetailBack()`/`onBikeDetailBack()` in `drawer-host.ts` rebuild the full picker payload (`{ destination, mode, stopId }`) instead of just `destination`, e.g.:
```ts
onHikeDetailBack() {
  const payload = this.svc.getPayload<HikeDetailPayload>('hike-detail')!;
  this.svc.close('hike-detail');
  this.svc.open('hikes', { destination: payload.destination, mode: payload.mode, stopId: payload.stopId });
}
```

### List component changes (`all-attractions`, `hikes-list`, `bikes-list`)
- Payload read becomes `payload()` → `destination()`/`mode()`/`stopId()` computed signals off the wrapped shape.
- Inject `TripPlannerService`. In select mode: `dayOptions = computed(() => stopDayOptions(trip(), stopId()!))`; `addedRefIds = computed(() => new Set(plannerSvc.getActivitiesForStop(stopId()!).filter(a => a.kind === KIND).map(a => a.refId)))`.
- Each card gains, only when `mode() === 'select'`: a day-select dropdown (hidden when `dayOptions().length <= 1` — single-day stops don't need a choice) and an Add/Added button, both with `(click)="$event.stopPropagation()"` so they don't also trigger the card's existing click-through.
- Card body click (`onAttractionClick`/`onRouteClick`) branches on `mode()`: **view** mode keeps today's behavior (select map marker + collapse to reveal it); **select** mode opens the detail drawer instead (`{ ..., source: 'all-attractions', mode: mode(), stopId: stopId() }`) — detail is view-only there, per the confirmed decision above.
- Add button calls `plannerSvc.addActivity({ stopId: stopId()!, kind: KIND, refId, day: selectedDay, name, lat, lon, distanceKm?, category? })`; already-added items render "Added" (tap to remove via `plannerSvc.removeActivity`).
- Implemented identically in all three components (attractions/hikes/bikes) rather than factored into a shared base — consistent with how hike/bike code already duplicates rather than shares (`hike-markers.ts`/`bike-markers.ts`).

Hotels stays a stub: Step 3's Hotels row opens the existing `hotels-stub` drawer as-is, no `mode`/`stopId` — there's no addable model for hotels (`ActivityKind` excludes `'hotel'`).

### `features/trip-planner/step3-activities/` (new)
- No inputs; `trip = toSignal(plannerSvc.trip$, ...)`.
- `visibleStops = computed(() => trip().stops.filter(s => s.days > 0))`.
- Per visible stop: header (pin + name + role badge + day range via `stopDayRanges()`), then 4 rows — Places to Visit / Hikes in the Area / Bike Rides / Hotels — each showing a count badge (`plannerSvc.getActivitiesForStop(stop.id).filter(a => a.kind === kind).length`) and opening the matching drawer in select mode:
```ts
openPicker(stop: TripStop, kind: ActivityKind): void {
  const key = kind === 'attraction' ? 'all-attractions' : kind === 'hike' ? 'hikes' : 'bikes';
  const point: GeoPoint = { id: stop.id, name: stop.name, lat: stop.lat, lon: stop.lon };
  this.drawerSvc.open(key, { destination: point, mode: 'select', stopId: stop.id });
}
```
- Each stop card also lists its already-added activities inline (grouped by kind), each with a remove (×) control calling `plannerSvc.removeActivity(activity.id)` — this is what makes removal work without reopening the picker drawer, per the confirmed decision above.
- Footer: Back / "View Summary" (`plannerSvc.prevStep()` / `plannerSvc.nextStep()`), matching the `TripPlanner3 - Activities.png` mockup.

`trip-planner-wizard.html`: add `@case (3) { <app-step3-activities /> }`; import `Step3Activities` into `TripPlannerWizard`.

### i18n
`trip.planner.step3.*`: `placesToVisit`, `hikesNearby`, `bikesNearby`, `hotelsNearby`, `hotelsComingSoon`, `addToTrip`, `added`, `removeFromTrip`, `selectDay` — across en/de/fr/it. Exact key set finalized during implementation.

### Out of scope (deferred to later phases)
- Map markers for added activities, distinguishable by kind — Phase 3 (Summary)'s concern.
- Editing an activity's assigned day after adding (would require remove-then-re-add today) — not requested; can revisit if UAT flags it.

## Phase 3 — Step 4 (Summary)

- `features/trip-planner/step4-summary/` — a timeline/summary view of the full trip (stops in order with their dates and assigned activities) plus a way to see it on the map (reusing the existing collapse-to-reveal-map pattern via `drawer.collapse('trip-planner')` rather than embedding a second map). Rail legs still missing a connection (skipped in Step 2) need a visible "needs a connection" notice with a jump-back action into Step 2's picker for that leg — informational only, never blocking. Exact layout (stat tiles, toggle control, banners) is open; `Summary` was shown in the reviewed mockups as illustration only (not saved to `context/screenshots`, but its shape — timeline + map toggle — is captured in this description).
- Map marker style: every stop numbered by visit order, with the final Destination visually distinguishable from earlier stops/departure (a different color is one option) — replacing today's distinct start/end icon scheme in favor of something that generalizes to N stops. Activity markers should be distinguishable by kind (attraction/hike/bike) — exact icon/color choices open.
- Marker click → small popup card (image + name [+ distance for hike/bike]) → opens the item's detail drawer, via an enriched MapLibre popup.
- i18n: `tripPlanner.step4.*` (`timeline`, `mapView`, `noActivities`, `routeComplete`).

## Phase 4 — Step 5 (Save Trip)

### Backend — `backend/src/models/Trip.js` fully replaced (no migration)
Schema mirrors the frontend model: `TripDateRangeSchema`, `TripStopSchema`, `TripConnectionLegSchema` (embeds full connection/section detail), `TripActivitySchema`, top-level `TripSchema{user, name, type, dateMode, range, stops, connections, activities, routeCoordinates, createdAt}`.
- `controllers/trips.js`: field lists updated; `getTrips`/`deleteTrip` unchanged.

### Frontend
- `features/trip-planner/step5-save/` — trip-name input, a short read-only summary of the trip (type/duration/destinations/activities counts is one reasonable set), a Save action, and a plain-text pointer to Profile for finding saved trips later ("Navigate to your profile to find your saved trips" — no separate browse-trips UI needed here), plus a way back to Summary. Exact layout open.
- `profile.ts/.html`: `viewTrip()` sets a one-shot flag so the wizard opens directly at Step 4 when loading a saved trip.
- i18n: `tripPlanner.step5.*` (`tripName`, `save`, `saveHint`, `savedSuccess`, `findSavedTrips`).

## Cross-cutting nav changes

- `shell/footer-nav/footer-nav.html/.ts`: replace "Explore" (`/explore`, dead) with "Trip Planner" → `/trip-planner`.
- Home hero CTA and side-nav "Plan a Trip" already target `/trip-planner` — unchanged.

## References

- @frontend/src/app/shared/services/drawer.ts
- @frontend/src/app/models/trip.ts
- @frontend/src/app/shared/services/trip-planner.ts
- @backend/src/controllers/hikingRoutes.js
- @frontend/src/app/shared/map/map.ts
- @backend/src/models/Trip.js
- @context/features/hike-feature-spec.md (superseded distance/GPX portions absorbed into Phase 0 above)

## History

<!-- Each phase branch appends its implementation log here -->
