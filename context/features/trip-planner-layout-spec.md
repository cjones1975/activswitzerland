# Trip Planner Layout Restructure

## Overview

Move trip planning out of `DestinationsLayout` into its own dedicated map-hosting layout/route, so "Plan a Trip" works correctly from every entry point (home, destination detail, profile) regardless of which page the user starts from.

---

## Problem

- `Home.openTripPlanner()` navigates to `/destinations` (`DestinationVerticalList` — a plain list, no map) and opens the `trip-planner` drawer. There is no `<app-map>` on that page for the route to render onto, so the feature does not functionally work from the home page.
- `Profile`'s "Plan your first trip" CTA and `viewTrip(trip)` (view a saved trip) have the same problem — the profile page has no map at all.
- Trip-planner-specific state (`tripRoute`/`tripType` signals, `TripPlannerService` subscriptions, drawer cleanup on destroy) currently lives inside `DestinationsLayout`, which should only be concerned with viewing a single destination. This makes `DestinationsLayout` messy and couples two unrelated features.

---

## New Routes — `@frontend/src/app/app.routes.ts`

Add two new routes under the existing `MainLayout` children, alongside `destinations/:id`:

```typescript
{ path: 'trip-planner', component: TripPlannerLayout },
{ path: 'trip-planner/:id', component: TripPlannerLayout },
```

- `/trip-planner` — no destination context (entry from home page / profile).
- `/trip-planner/:id` — destination context, where `:id` is `Destination.identifier` (entry from destination detail).

Both render the same new `TripPlannerLayout` shell component.

---

## New Component — `TripPlannerLayout`

Location: `@frontend/src/app/shell/trip-planner-layout/` (`trip-planner-layout.ts`, `.html`, `.css`, `.spec.ts`), modeled on `@frontend/src/app/shell/destinations-layout/` but trimmed to trip-planning concerns only.

### Responsibilities

- Host `<app-map>` full-screen. Re-use the `destinations-layout.css` `.map-wrapper` / `.reopen-btns` / `.reopen-btn` styles for layout consistency.
- Own the `tripRoute` and `tripType` signals, fed by `TripPlannerService.routeCoordinates$` and `TripPlannerService.trip$` (moved out of `DestinationsLayout`), bound to `<app-map [tripRoute]="tripRoute()" [tripType]="tripType()">`.
- Read the optional `:id` route param via `ActivatedRoute.paramMap` (same pattern `DestinationsLayout` already uses for its `:id` param — including the lang-aware `switchMap` over `translate.onLangChange`).

### `ngOnInit` behavior

- **If `:id` is present**: fetch the destination via `DestinationsService.getDestination(id, lang)`, set `center` to `[dest.geo.longitude, dest.geo.latitude]`, store the result in a `destination` signal, then call `drawer.open('trip-planner', dest.name)`. This re-uses the existing name-based prefill already implemented in `TripPlanner` (the `prefillName` computed + effect that searches `TransportService.searchLocations(name, type)` and fills the "to" stop) — no change needed there for this path.
- **If `:id` is absent**: call `drawer.open('trip-planner')` with no payload.
- **Centering on a loaded saved trip**: if there is no `:id` (so `center` would otherwise be unset) and `TripPlannerService`'s route coordinates are non-empty when first received (i.e. a saved trip was loaded via `loadSavedTrip`, see below), set `center` to the midpoint of the route's bounding box: `[(minLon+maxLon)/2, (minLat+maxLat)/2]`.

### `ngOnDestroy`

- `drawer.close('trip-planner')`
- `tripPlanner.reset()`

### Map overlay buttons

Mirrors the `reopen-btns` pattern in `destinations-layout.html`:

- **"Back to destination"** — visible only when `destination()` is set (i.e. only on `/trip-planner/:id`). Uses i18n key `attractions.backToDestination` ("Back to destination" — already exists in all locales) and icon `fa-sharp fa-solid fa-circle-arrow-left`. Routes to `/destinations/:id`.
- **"Open trip planner"** — visible whenever `!drawer.isOpen('trip-planner')`. Uses new i18n key `trip.planner.open` and icon `fa-light fa-route`. Calls `drawer.open('trip-planner')`.

This pairs with the drawer-close behavior below: the drawer's existing X button only calls `drawer.close('trip-planner')` (no navigation, no change needed in `drawer-host.ts`), so the user can close the drawer to interact with the map and reopen it via the "Open trip planner" button without losing their place.

---

## `DestinationsLayout` — strip trip-planner concerns

`@frontend/src/app/shell/destinations-layout/destinations-layout.ts` / `.html`:

- Remove the `TripPlannerService` injection and the `tripRoute` / `tripType` signals and their `routeCoordinates$` / `trip$` subscriptions in `ngOnInit`.
- Remove the `[tripRoute]` / `[tripType]` bindings from `<app-map>`.
- Remove `this.drawer.close('trip-planner')` and `this.tripPlanner.reset()` from `ngOnDestroy`.

---

## Trigger points — replace `drawer.open('trip-planner', ...)` with navigation

### Home — `@frontend/src/app/features/home/home.ts`

`openTripPlanner()` becomes:

```typescript
openTripPlanner(): void {
  this.router.navigate(['/trip-planner']);
}
```

Remove the `Drawer` injection (no longer used in this component).

### Destination Detail — `@frontend/src/app/features/destinations/destination-detail/destination-detail.ts`

`openTripPlanner()` becomes:

```typescript
openTripPlanner(): void {
  const dest = this.destination();
  if (!dest) return;
  this.router.navigate(['/trip-planner', dest.identifier]);
}
```

Inject `Router`. Remove the `this.drawerSvc.open('trip-planner', dest.name)` call (the `Drawer` injection itself stays — still used for `destination`/`openWeather`).

### Profile — `@frontend/src/app/features/auth/profile/profile.ts`

- `openTripPlanner()` (the "Plan your first trip" CTA) becomes `this.router.navigate(['/trip-planner'])`.
- `viewTrip(trip: SavedTrip)` becomes:

```typescript
viewTrip(trip: SavedTrip): void {
  this.tripPlannerSvc.loadSavedTrip(trip);
  this.router.navigate(['/trip-planner']);
}
```

Inject `TripPlannerService`. Remove the `Drawer` injection if it is no longer used elsewhere in `profile.ts`.

---

## `TripPlannerService` — load a saved trip

`@frontend/src/app/shared/services/trip-planner.ts`:

```typescript
loadSavedTrip(trip: SavedTrip): void {
  this._trip$.next({
    type: trip.type,
    stops: trip.stops,
    routeCoordinates: trip.routeCoordinates,
    name: trip.name,
  });
  this._routeCoordinates$.next(trip.routeCoordinates);
}
```

### Model change — `@frontend/src/app/models/trip.ts`

Add an optional `name` field to `PlannedTrip`:

```typescript
export interface PlannedTrip {
  type: 'road' | 'rail';
  stops: TripStop[];
  name?: string;
  connections?: TripConnection[];
  selectedConnection?: TripConnection;
  attractions?: Attraction[];
  routeCoordinates?: [number, number][];
}
```

---

## `TripPlanner` component — restore state from the service snapshot

`@frontend/src/app/features/trip-planner/trip-planner.ts`:

So that closing the drawer (X button) and reopening it (via the new map button), or loading a saved trip via `loadSavedTrip`, doesn't drop the user's in-progress trip:

- On construction, if `plannerSvc.snapshot.stops.length > 0`, populate from the snapshot:
  - `selectedType.set(snapshot.type)`
  - `stops.set(snapshot.stops)`
  - `stopSuggestions.set(snapshot.stops.map(() => []))`
  - `tripName.set(snapshot.name ?? '')`
  - Do **not** call `onStopsChanged()` / re-fetch the road route — `routeCoordinates$` already holds the correct route and feeds the map directly via `TripPlannerLayout`.
- Whenever `stops` changes (`onStopSelect`, `onStopClear`, `addStop`, `removeStop`), also call `plannerSvc.setStops(this.validStops())` so the snapshot stays current.
- Add an `(ngModelChange)` handler on the trip-name input that updates `tripName` and also calls `plannerSvc.setName(name)` (new small setter on `TripPlannerService`, mirroring `setStops`) so the name round-trips through the snapshot too.
- The existing `prefillName` computed/effect (destination-name prefill from the drawer payload, used by the `/trip-planner/:id` flow) is unchanged. It only acts on a string drawer payload, which is never set in the saved-trip / reopen flows, so there's no conflict with the snapshot-restore logic above.

---

## i18n

Add a new key `trip.planner.open` ("Open trip planner") to all four locale files (`en.json`, `de.json`, `fr.json`, `it.json`), following the existing pattern of `destinations.detail.open` ("Open destination") / `attractions.openAll` ("Open attractions").

---

## Out of Scope

- Attraction discovery along the route (separate, already-reverted in-progress feature — see commit `c2364f4`).
- Any change to `TripsService` CRUD endpoints or the backend `Trip` model.
- Drawer header "back" links / `drawer-host.ts` changes — the back/reopen affordances live as map overlay buttons in `TripPlannerLayout`, not in the drawer header.

---

## References

- @context/features/trip-planner-spec.md (original feature spec)
- @frontend/src/app/shell/destinations-layout/destinations-layout.ts
- @frontend/src/app/shell/destinations-layout/destinations-layout.html
- @frontend/src/app/shell/destinations-layout/destinations-layout.css
- @frontend/src/app/features/trip-planner/trip-planner.ts
- @frontend/src/app/shared/services/trip-planner.ts
- @frontend/src/app/shared/services/drawer.ts
- @frontend/src/app/shared/drawer-host/drawer-host.ts
- @frontend/src/app/features/home/home.ts
- @frontend/src/app/features/destinations/destination-detail/destination-detail.ts
- @frontend/src/app/features/auth/profile/profile.ts
- @frontend/src/app/models/trip.ts
- @frontend/src/app/app.routes.ts
