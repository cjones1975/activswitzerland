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

- `features/trip-planner/step3-activities/` — iterates `trip.stops` in itinerary order, shows each stop's date range and 4 activity pickers underneath: Places to Visit, Hikes in the Area, Bike Rides, Hotels (soft-disabled). Each activity kind should be visually distinguishable at a glance (e.g. a distinct icon/color per kind) — exact styling open, `Places to visit.png`/`Bike rides.png` illustrate the idea, not the final look.
- Extend `all-attractions`/`hikes`/`bikes` drawer payloads with `mode: 'view'|'select'` + `stopId` — select mode needs a way to assign a picked item to one of the stop's available days and show it's been added; an inline day-select + add button, toggling to an "added" state once selected, is one reasonable pattern.
- `TripPlannerService`: `addActivity()`, `removeActivity()`, `getActivitiesForStopDay(stopId, day)`.
- Hotels picker reuses Phase 0's stub with a "coming soon" banner.
- i18n: `tripPlanner.step3.*` (`placesToVisit`, `hikesNearby`, `bikesNearby`, `hotelsNearby`, `hotelsComingSoon`, `assignToDay`, `removeFromDay`, `added`).

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
