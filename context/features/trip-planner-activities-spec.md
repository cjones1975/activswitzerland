# Trip Planner — Step 3 (Activities)

## Why

Phase 2 of the trip planner rebuild (see `trip-planner-rebuild-spec.md`). Step 3 lets the
user add attractions/hikes/bike rides to each stop of their itinerary, one specific day at
a time. The wizard shell already reserves this step (`TripPlannerWizard`'s `STEP_KEYS`
includes `'activities'` and the step indicator already renders it) and the data model
already has `ActivityKind`/`TripActivitySelection`/`PlannedTrip.activities` from Phase 1 —
both unused until now. Mockups: `context/screenshots/TripPlanner3 - Activities.png`,
`TripPlanner4 - Places to visit.png`, `TripPlanner5 - Bike rides.png` (journey/shape
reference only, not a pixel spec — see `context/features/trip-planner-rebuild-spec.md`'s
note on mockups).

## Confirmed decisions

- Tapping an activity card in select mode opens its full detail drawer (photo/description,
  same as today's view-mode behavior) — view-only, no Add control there. Closing detail
  returns to the picker list it came from (not straight back to the wizard), so Add always
  happens from the list card itself.
- Each attraction/hike/bike can be added to a given stop **once** — the Add button becomes
  a terminal "Added" state per stop (not per-day-repeatable). Re-tapping "Added" removes it.
- Removal is available both from the picker list (via the "Added" toggle) and from the
  stop's own inline added-items list in Step 3, and again from Step 4 (Summary) —
  not Step-3-only.
- Stops with `days === 0` (same-day pass-throughs, or a non-day departure point like "home")
  show no activity pickers at all — there's no day to assign an activity to.

## Architecture: decoupling the activity pickers from the MySwitzerland catalogue

`all-attractions`/`hikes-list`/`bikes-list` currently require a full MySwitzerland
`Destination` (`models/destination.ts`) — nested `geo.latitude`/`geo.longitude`,
`identifier`, `abstract`, `photo`, etc — because every existing caller
(`destination-detail`, `attraction-vertical-list`, `destinations-layout`) already holds
one. Trip Planner stops (`TripStop`) are free-text address/station search results per
Phase 1 — flat `lat`/`lon`, no MySwitzerland `identifier`, no catalogue metadata.

All three pickers already query by radius off plain coordinates under the hood —
`AttractionsService.getAttractionsNearby(lat, lon, ...)` builds
`geo.dist=lat,lon,radiusMeters`, and hikes/bikes call geo.admin.ch by `lat`/`lon`/`radius`
directly (Phase 0) — the coordinate is just currently sourced from
`dest.geo.latitude`/`dest.geo.longitude`. No new backend capability is needed, only
decoupling the existing radius query from requiring a full catalogue object to carry the
coordinate.

New minimal type (`models/geo-point.ts`):
```ts
export interface GeoPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
}
```
`all-attractions.ts`, `hikes-list.ts`, `bikes-list.ts`: widen their destination payload
field to `Destination | GeoPoint`; normalize the handful of read sites (dedup-by-id effect,
`geo.latitude`/`geo.longitude` radius-fetch call) to read through a flat lat/lon/id
accessor that works for either shape, instead of assuming a nested `.geo`.
`attraction-detail`/`hike-detail`/`bike-detail` get the same widening on their
`destination`/origin field (used only for back-nav + breadcrumb text there, never
re-fetched by identifier).

## Data model / service

`models/trip.ts` already has `ActivityKind`/`TripActivitySelection`/`PlannedTrip.activities`
from Phase 1, unused until now — no model changes needed.

`shared/services/trip-planner.ts` (`TripPlannerService`) gains:
```ts
addActivity(selection: Omit<TripActivitySelection, 'id'>): void
removeActivity(activityId: string): void
isActivityAdded(stopId: string, kind: ActivityKind, refId: string): boolean
getActivitiesForStop(stopId: string): TripActivitySelection[]
```
All mutators go through the existing `_trip$`/autosave pipeline, same as `updateStopDays`.

`shared/utils/date-range.ts` gains a day-range utility, generalized out of
`Step2Itinerary`'s local `stopDayLabels` computed (today's only place that turns
`TripStop.days` counts into concrete day numbers):
```ts
export function stopDayRanges(stops: TripStop[]): Map<string, { start: number; end: number }>
export function stopDayOptions(trip: PlannedTrip, stopId: string): (string | number)[]
```
`stopDayOptions` converts a stop's `{start, end}` range into concrete values a day-picker
dropdown can offer: integers in `days` mode, ISO date strings (`trip.range.startDate` +
offset) in `dates` mode. `Step2Itinerary` is refactored to call `stopDayRanges()` instead
of its local computed — no behavior change there.

## Drawer payload changes

`all-attractions`/`hikes`/`bikes` payloads become wrapped objects instead of a bare
`Destination`:
```ts
export interface ActivityPickerPayload {
  destination: Destination | GeoPoint;
  mode?: 'view' | 'select';   // default 'view'
  stopId?: string;             // set when mode === 'select'
}
```
Every existing `drawerSvc.open('all-attractions'|'hikes'|'bikes', destination)` call site
updates to `.open(key, { destination })` — `mode` omitted defaults to `'view'`, so existing
behavior is unchanged.

`AttractionDetailPayload`/`HikeDetailPayload`/`BikeDetailPayload` gain `mode?`/`stopId?` so
back-nav can reconstruct the picker's payload on the way back.
`AttractionDetailPayload.source`'s existing-but-unused `'trip-planner'` value is removed —
select-mode card taps keep `source: 'all-attractions'`, and
`onAttractionDetailBack()`/`onHikeDetailBack()`/`onBikeDetailBack()` in `drawer-host.ts`
rebuild the full picker payload (`{ destination, mode, stopId }`) instead of just
`destination`, e.g.:
```ts
onHikeDetailBack() {
  const payload = this.svc.getPayload<HikeDetailPayload>('hike-detail')!;
  this.svc.close('hike-detail');
  this.svc.open('hikes', { destination: payload.destination, mode: payload.mode, stopId: payload.stopId });
}
```

## List component changes (`all-attractions`, `hikes-list`, `bikes-list`)

- Payload read becomes `payload()` → `destination()`/`mode()`/`stopId()` computed signals
  off the wrapped shape.
- Inject `TripPlannerService`. In select mode:
  `dayOptions = computed(() => stopDayOptions(trip(), stopId()!))`;
  `addedRefIds = computed(() => new Set(plannerSvc.getActivitiesForStop(stopId()!).filter(a => a.kind === KIND).map(a => a.refId)))`.
- Each card gains, only when `mode() === 'select'`: a day-select dropdown (hidden when
  `dayOptions().length <= 1` — single-day stops don't need a choice) and an Add/Added
  button, both with `(click)="$event.stopPropagation()"` so they don't also trigger the
  card's existing click-through.
- Card body click (`onAttractionClick`/`onRouteClick`) branches on `mode()`: **view** mode
  keeps today's behavior (select map marker + collapse to reveal it); **select** mode opens
  the detail drawer instead (`{ ..., source: 'all-attractions', mode: mode(), stopId: stopId() }`)
  — detail is view-only there, per the confirmed decisions above.
- Add button calls
  `plannerSvc.addActivity({ stopId: stopId()!, kind: KIND, refId, day: selectedDay, name, lat, lon, distanceKm?, category? })`;
  already-added items render "Added" (tap to remove via `plannerSvc.removeActivity`).
- Implemented identically in all three components (attractions/hikes/bikes) rather than
  factored into a shared base — consistent with how hike/bike code already duplicates
  rather than shares (`hike-markers.ts`/`bike-markers.ts`).

Hotels stays a stub: Step 3's Hotels row opens the existing `hotels-stub` drawer as-is, no
`mode`/`stopId` — there's no addable model for hotels (`ActivityKind` excludes `'hotel'`).

## `features/trip-planner/step3-activities/` (new)

- No inputs; `trip = toSignal(plannerSvc.trip$, ...)`.
- `visibleStops = computed(() => trip().stops.filter(s => s.days > 0))`.
- Per visible stop: header (pin + name + role badge + day range via `stopDayRanges()`),
  then 4 rows — Places to Visit / Hikes in the Area / Bike Rides / Hotels — each showing a
  count badge (`plannerSvc.getActivitiesForStop(stop.id).filter(a => a.kind === kind).length`)
  and opening the matching drawer in select mode:
```ts
openPicker(stop: TripStop, kind: ActivityKind): void {
  const key = kind === 'attraction' ? 'all-attractions' : kind === 'hike' ? 'hikes' : 'bikes';
  const point: GeoPoint = { id: stop.id, name: stop.name, lat: stop.lat, lon: stop.lon };
  this.drawerSvc.open(key, { destination: point, mode: 'select', stopId: stop.id });
}
```
- Each stop card also lists its already-added activities inline (grouped by kind), each
  with a remove (×) control calling `plannerSvc.removeActivity(activity.id)` — this is what
  makes removal work without reopening the picker drawer, per the confirmed decisions above.
- Footer: Back / "View Summary" (`plannerSvc.prevStep()` / `plannerSvc.nextStep()`),
  matching the `TripPlanner3 - Activities.png` mockup.

`trip-planner-wizard.html`: add `@case (3) { <app-step3-activities /> }`; import
`Step3Activities` into `TripPlannerWizard`.

## i18n

`trip.planner.step3.*`: `placesToVisit`, `hikesNearby`, `bikesNearby`, `hotelsNearby`,
`hotelsComingSoon`, `addToTrip`, `added`, `removeFromTrip`, `selectDay` — across
en/de/fr/it. Exact key set finalized during implementation.

## Out of scope (deferred to later phases)

- Map markers for added activities, distinguishable by kind — Phase 3 (Summary)'s concern.
- Editing an activity's assigned day after adding (would require remove-then-re-add today)
  — not requested; can revisit if UAT flags it.

## References

- @frontend/src/app/shared/services/trip-planner.ts
- @frontend/src/app/models/trip.ts
- @frontend/src/app/shared/services/drawer.ts
- @frontend/src/app/shared/drawer-host/drawer-host.ts
- @frontend/src/app/features/attractions/all-attractions/all-attractions.ts
- @frontend/src/app/features/hikes/hikes-list/hikes-list.ts
- @frontend/src/app/features/bikes/bikes-list/bikes-list.ts
- @frontend/src/app/features/trip-planner/step2-itinerary/step2-itinerary.ts
- @frontend/src/app/shared/services/attractions.ts
- @context/features/trip-planner-rebuild-spec.md
