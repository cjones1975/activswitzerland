# Destination Detail Fixes (2)

## Overview

Seven fixes to `destination-detail` and its surrounding map/drawer/trip-planner chrome, prompted by adding the Mountains, Lakes & Glaciers and Nature Parks categories to the homepage:

1. Hide all attraction UI (top-attractions list, "see all" link) when a destination has zero attractions.
2. The destination-detail map should only ever show a single red, larger "destination" pin. Attraction pins are only added while the user is actually browsing the all-attractions list (open or collapsed-to-map).
3. `.action-grid`'s "Plan a Trip" and weather boxes sit side by side instead of stacked, with equal height driven by the taller (weather) box.
4. "Back to destinations" returns to the category (cities / mountains-lakes / nature-parks) the user actually came from, instead of always defaulting to City Breaks.
5. "Plan a Trip" → road-trip seeds the 'to' stop directly from the destination's own coordinates instead of a live address search, so mountain/lake/glacier destinations (which usually have no matching street address) still prefill correctly — OSRM's road router snaps to the nearest reachable road on its own.
6. If OSRM can't find a road close enough to that destination at all, show a clear message and block the user from proceeding past the stops step.
7. The pre-filled 'to' stop from item 5 is now locked (non-editable, no remove button) — the user picked that destination deliberately, so clearing/retyping it would be a dead end (mountain/lake/glacier names aren't searchable).

The **rail** half of item 5 (nearest-station lookup for destinations with no real station) is intentionally out of scope — still under discussion, no implementation direction agreed yet.

---

## 1. Hide attraction UI when a destination has zero attractions

`@frontend/src/app/shared/services/attraction-markers.ts`:

- Add a `hasAttractions` signal, defaulting to `true` (avoids a flash-hide of the reopen buttons before the first load resolves):

```typescript
readonly hasAttractions = signal(true);

setHasAttractions(value: boolean): void {
  this.hasAttractions.set(value);
}
```

- Reset it to `true` in `clear()` alongside the existing resets.

`@frontend/src/app/features/attractions/attraction-vertical-list/attraction-vertical-list.ts`:

- In the load subscription's success branch, report whether any attractions came back (top or fallback):

```typescript
this.loadError.set(false);
this.attractions = result.attractions;
this.isTop.set(result.isTop);
this.attractionMarkers.setHasAttractions(result.attractions.length > 0);
this.loading.set(false);
```

- Remove the `geoAttractions` / `this.attractionMarkers.set(...)` block from this success branch entirely — map-marker population moves to the all-attractions page only (see #2). Drop the now-unused `hasValidGeo` import.

`@frontend/src/app/features/attractions/attraction-vertical-list/attraction-vertical-list.html`:

- Wrap the whole template in a guard so nothing renders once loading finishes with zero attractions:

```html
@if (loading() || loadError() || attractions.length) {
  <div class="attractions-section">
    ...
  </div>
}
```

`@frontend/src/app/shell/destinations-layout/destinations-layout.ts`:

- Change `private attractionMarkers = inject(AttractionMarkersService);` to `protected attractionMarkers = inject(AttractionMarkersService);` so the template can read `hasAttractions()`.

`@frontend/src/app/shell/destinations-layout/destinations-layout.html`:

- Gate both reopen buttons on `attractionMarkers.hasAttractions()`:

```html
@if (!drawer.isOpen('destination-detail') && destination(); as dest) {
  <button class="reopen-btn" type="button" (click)="openDetail()">
    <i class="fa-solid fa-map-location-dot"></i>
    {{ 'destinations.detail.open' | translate: { name: dest.name } }}
  </button>
}
@if (destination() && attractionMarkers.hasAttractions() && !drawer.isOpen('all-attractions') && !drawer.isCollapsed('all-attractions')) {
  <button class="reopen-btn" type="button" (click)="listAllAttractions()">
    <i class="fa-solid fa-list"></i>
    {{ 'attractions.listAll' | translate }}
  </button>
}
@if (attractionMarkers.hasAttractions() && drawer.isCollapsed('all-attractions')) {
  <button class="reopen-btn" type="button" (click)="reopenAllAttractions()">
    <i class="fa-solid fa-list"></i>
    {{ 'attractions.openAll' | translate }}
  </button>
}
```

No change needed to `AllAttractions` — it's simply never reachable once the reopen button is hidden, and it already handles an empty result set with its existing skeleton/empty states.

---

## 2. Destination-only marker; attraction pins only on the all-attractions page

`@frontend/src/app/features/attractions/attraction-vertical-list/attraction-vertical-list.ts`:

- `onAttractionClick` no longer relies on a map marker existing (see #1 — markers are no longer seeded from the top-attractions list). Instead it opens `attraction-detail` directly:

```typescript
onAttractionClick(attraction: Attraction): void {
  const dest = this.drawerSvc.getPayload<Destination>('destination-detail');
  this.drawerSvc.close('destination-detail');
  this.drawerSvc.open('attraction-detail', { attraction, destination: dest, source: 'destination-detail' });
}
```

(`AttractionDetailPayload['source']` already includes `'destination-detail'` in its union — this was previously unused.)

`@frontend/src/app/shared/drawer-host/drawer-host.ts`:

- `onAttractionDetailBack()` gains a branch for the new source, returning to `destination-detail` with the stored destination payload:

```typescript
onAttractionDetailBack() {
  const payload = this.svc.getPayload<AttractionDetailPayload>('attraction-detail')!;
  this.svc.close('attraction-detail');
  if (payload.source === 'things-to-do') {
    this.svc.open('things-to-do', { stop: payload.stop });
    return;
  }
  if (payload.source === 'trip-planner') {
    this.svc.open('trip-planner');
    return;
  }
  if (payload.source === 'destination-detail') {
    this.svc.open('destination-detail', payload.destination);
    return;
  }
  this.svc.open('all-attractions', payload.destination);
}
```

- Add a computed for the back-button label's destination name:

```typescript
attractionDetailDestinationName = computed(() => {
  this.svc.list();
  return this.svc.getPayload<AttractionDetailPayload>('attraction-detail')?.destination?.name ?? '';
});
```

`@frontend/src/app/shared/drawer-host/drawer-host.html` — attraction-detail header, add a branch reusing the existing `attractions.backToDestination` key:

```html
<button class="dest-back" type="button" (click)="onAttractionDetailBack()">
    <i class="fa-regular fa-chevron-left"></i>
    @if (attractionDetailSource() === 'things-to-do') {
        {{ 'trip.planner.thingsToDo.backToList' | translate }}
    } @else if (attractionDetailSource() === 'trip-planner') {
        {{ 'trip.planner.backToPlanner' | translate }}
    } @else if (attractionDetailSource() === 'destination-detail') {
        {{ 'attractions.backToDestination' | translate: { name: attractionDetailDestinationName() } }}
    } @else {
        {{ 'attractions.backToAttractions' | translate }}
    }
</button>
```

`@frontend/src/app/shell/destinations-layout/destinations-layout.ts`:

- Add a computed destination marker (always shown while on this page) and gate attraction pins behind whether the user is actually browsing the all-attractions list (open, collapsed-to-map, or viewing an attraction reached from that list):

```typescript
import { AttractionDetailPayload } from '../../features/attractions/attraction-detail/attraction-detail';

// ...

private attractionDetailSource = computed(() => {
  this.drawer.list();
  return this.drawer.getPayload<AttractionDetailPayload>('attraction-detail')?.source;
});

private showAttractionMarkers = computed(() => {
  this.drawer.list();
  if (this.drawer.isOpen('all-attractions') || this.drawer.isCollapsed('all-attractions')) return true;
  return this.drawer.isOpen('attraction-detail') && this.attractionDetailSource() === 'all-attractions';
});

destinationMarker = computed<MapMarker | null>(() => {
  const dest = this.destination();
  if (!dest?.geo?.latitude || !dest?.geo?.longitude) return null;
  return {
    id: 'destination-marker',
    lng: dest.geo.longitude,
    lat: dest.geo.latitude,
    label: dest.name,
    icon: 'fa-solid fa-location-dot',
    color: '#e53e3e',
    className: 'destination-marker',
  };
});

displayMarkers = computed(() => {
  const selectedId = this.attractionMarkers.selectedId();
  const attractionPins = this.showAttractionMarkers()
    ? this.attractionMarkers.markers().map(m =>
        selectedId && m.id === selectedId ? { ...m, highlight: true } : m
      )
    : [];
  const destMarker = this.destinationMarker();
  return destMarker ? [destMarker, ...attractionPins] : attractionPins;
});
```

`@frontend/src/app/shared/map/map.css` — new size modifier for the destination pin, bigger than both the default (`1.5rem`) and the selected-attraction size (`2rem`):

```css
.map-marker-icon.destination-marker {
  font-size: 2.2rem;
  filter: drop-shadow(0 2px 4px rgba(229, 62, 62, 0.5));
}
```

Color comes from `marker.color: '#e53e3e'` (red), already wired through `buildMarkerEl`/`syncMarkers` in `map.ts` — no `map.ts` changes needed.

No changes needed to `AllAttractions` or `AttractionMarkersService.set()` — that component is still the only place that ever populates `markers()`/`attractionMap()`; `DestinationsLayout` now simply chooses whether to render them.

---

## 3. Plan Trip / Weather boxes side by side, equal height

`@frontend/src/app/features/destinations/destination-detail/destination-detail.css`:

- Change `.action-grid` to two columns. CSS Grid stretches both children to the row's height by default, and the row height is set by its tallest cell (the weather box) — no JS needed, `.plan-card`'s existing `align-items: center` re-centers its icon/text within the taller box automatically:

```css
.action-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.875rem;
}
```

- Add a narrow-viewport fallback so the two cards don't get cramped in the drawer at small widths:

```css
@media (max-width: 400px) {
  .action-grid {
    grid-template-columns: 1fr;
  }
}
```

- `.plan-card` and `.weather-box` keep their existing `min-height: 80px` as a floor; no other rule changes required.

No `.html`/`.ts` changes needed for this item.

---

## 4. Dynamic "back to destinations" category link

Today every destination card links to `/destinations/:id` with no query params, so `DrawerHost.onDestinationBack()` always navigates to `/destinations` with no `category`, which `DestinationVerticalList` defaults to `cities`. Fix: carry the originating category through the URL as a `category` query param, and read it back on the way out.

`@frontend/src/app/features/destinations/destination-horizontal-list/destination-horizontal-list.ts`:

- Add a `categoryKey` input:

```typescript
import { CategoryKey } from '../../../models/destination-category';

@Input() categoryKey: CategoryKey | '' = '';
```

`@frontend/src/app/features/destinations/destination-horizontal-list/destination-horizontal-list.html`:

- Carry the category onto each card link (the existing "view all" link's `viewAllQueryParams` is unrelated/unchanged):

```html
<a class="destination-card"
   [routerLink]="['/destinations', dest.identifier]"
   [queryParams]="categoryKey ? { category: categoryKey } : {}"
   [style.background-image]="'url(' + dest.photo + ')'">
```

`@frontend/src/app/features/home/home.html`:

- Pass `categoryKey` alongside the existing `viewAllQueryParams` on each of the three sections:

```html
<app-destination-horizontal-list
  ...
  categoryKey="cities"
  viewAllRoute="/destinations"
  [viewAllQueryParams]="{ category: 'cities' }">
</app-destination-horizontal-list>
```

(`"mountains-lakes"` and `"nature-parks"` for the other two sections respectively.)

`@frontend/src/app/features/destinations/destination-vertical-list/destination-vertical-list.ts`:

- Track the resolved `CategoryKey` (not just the `CategoryConfig`) so it can be passed onward:

```typescript
config = signal<CategoryConfig>(DESTINATION_CATEGORIES.cities);
categoryKey = signal<CategoryKey>('cities');

// inside the existing tap(([params]) => { ... }):
tap(([params]) => {
  const requested = params.get('category') as CategoryKey | null;
  const resolved: CategoryKey = requested && DESTINATION_CATEGORIES[requested] ? requested : 'cities';
  this.categoryKey.set(resolved);
  this.config.set(DESTINATION_CATEGORIES[resolved]);
  this.loading.set(true);
}),
```

`@frontend/src/app/features/destinations/destination-vertical-list/destination-vertical-list.html`:

- Carry the category onto each card link the same way:

```html
<a class="destination-card" [routerLink]="['/destinations', dest.identifier]" [queryParams]="{ category: categoryKey() }">
```

`@frontend/src/app/shared/drawer-host/drawer-host.ts`:

- `onDestinationBack()` reads `category` off the current URL (via `Router.parseUrl`, which works regardless of where `DrawerHost` sits in the injector/component tree — no `ActivatedRoute` injection needed) and forwards it:

```typescript
onDestinationBack() {
  this.svc.close('destination-detail');
  const category = this.router.parseUrl(this.router.url).queryParams['category'];
  this.router.navigate(['/destinations'], category ? { queryParams: { category } } : {});
}
```

No changes needed in `DestinationsLayout` (`/destinations/:id`) — the `category` query param simply rides along in the URL from the originating link through to this back-navigation; it's never read or acted on by the detail page itself.

**Fallback:** destinations reached without a category in the URL (direct link, bookmark, share) still go back to `/destinations` with no `category`, which continues to default to City Breaks — unchanged, sensible fallback.

---

## 5. Road-trip prefill uses the destination's own coordinates (rail unchanged)

Today, "Plan a Trip" (`destination-detail.html`'s `plan-card`, routing to `/trip-planner/:id`) opens the `trip-planner` drawer with just `dest.name` as payload. `TripPlanner`'s constructor effect takes that name and calls `TransportService.searchLocations(name, selectedType())` — for `selectedType() === 'road'` this queries the transport API's `address` geocoder. Mountain/lake/glacier destinations frequently have no matching street address, so the search returns nothing and the 'to' stop is silently left empty. We already know the destination's exact coordinates (`dest.geo`) — no search is needed at all for the road case.

`@frontend/src/app/shell/trip-planner-layout/trip-planner-layout.ts`:

- When opening the drawer for a known destination with valid geo, pass a small object instead of a bare name string; fall back to the old string payload if geo is missing (edge case — preserves today's search-based behavior for that case):

```typescript
this.destination.set(dest);
if (dest) {
  const hasGeo = !!(dest.geo?.latitude && dest.geo?.longitude);
  if (hasGeo) {
    this.mapZoom.set(12);
    this.center.set([dest.geo.longitude, dest.geo.latitude]);
  }
  this.drawer.open('trip-planner', hasGeo
    ? { name: dest.name, lat: dest.geo.latitude, lon: dest.geo.longitude, identifier: dest.identifier }
    : dest.name);
} else {
  this.drawer.open('trip-planner');
}
```

`@frontend/src/app/features/trip-planner/trip-planner.ts`:

- Replace the `prefillName` computed with one that accepts either payload shape, and branch the effect on trip type — road seeds the stop directly (no HTTP call), rail keeps today's name-based station search unchanged:

```typescript
interface TripPlannerPrefill {
  name: string;
  lat: number;
  lon: number;
  identifier: string;
}

private readonly prefillPayload = computed(() => {
  this.drawerSvc.list();
  return this.drawerSvc.getPayload<string | TripPlannerPrefill>('trip-planner') ?? null;
});
```

```typescript
effect(() => {
  const payload = this.prefillPayload();
  if (!payload) return;
  untracked(() => {
    if (typeof payload === 'object' && this.selectedType() === 'road') {
      const stop: TripStop = {
        stationId: `dest:${payload.identifier}`,
        name: payload.name,
        lat: payload.lat,
        lon: payload.lon,
      };
      this.stops.set([null, stop]);
      this.plannerSvc.setStops(this.validStops());
      this.onStopsChanged();
      return;
    }
    const name = typeof payload === 'string' ? payload : payload.name;
    this.transportSvc.searchLocations(name, this.selectedType())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(results => {
        const match = results[0];
        if (match) this.stops.set([null, match]);
      });
  });
});
```

`stationId: 'dest:' + identifier` is synthetic (not a real transit station id) but that's fine — `TripStop.stationId` is only ever used as a local grouping key (`TripPlannerService.toggleAttraction`/`getSelections`/`hydrateSelections` in the "things to do" flow) and for `getConnections`/`getConnectionJourneys` (rail-only, not reached in this branch). `TripPlannerService.buildRoadRoute` only reads `lon`/`lat` from each stop and hands them to the public OSRM driving router, which snaps each point to its nearest routable road — so a glacier/mountain-lake coordinate naturally resolves to "as close as possible by car" with no extra backend work.

No changes to `TransportService`, `TripPlannerService`, or the rail path — `getConnections`/`getConnectionJourneys` still require a real `stationId`/name and are unaffected. Switching trip type from road to rail (or vice versa) after landing on the page already resets `stops` to `[null, null]` (`onTypeChange`) and is not re-prefilled by either path — pre-existing behavior, not changed here.

---

## 6. OSRM "no road close enough" blocks the stops step

Today `TripPlannerService.buildRoadRoute()` silently resolves to `[]` when OSRM returns a non-`Ok` `code` (`NoRoute`, or `NoSegment` when a coordinate is outside OSRM's snap radius — the case a truly remote mountain/glacier coordinate can hit). The map just shows no route and the user can still proceed past the stops step. Fix: surface that as a distinct, blocking condition.

`@frontend/src/app/shared/services/trip-planner.ts`:

```typescript
buildRoadRoute(stops: TripStop[]): Observable<[number, number][]> {
  if (stops.length < 2) return of([]);
  const coords = stops.map(s => `${s.lon},${s.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  return this.http.get<any>(url).pipe(
    map(res => {
      if (res.code !== 'Ok' || !res.routes?.[0]) {
        throw new Error('NO_ROAD_ROUTE');
      }
      return res.routes[0].geometry.coordinates;
    }),
  );
}
```

`@frontend/src/app/features/trip-planner/trip-planner.ts`:

- Add a `routeUnreachable` signal alongside the existing `routeError`, distinguish it in the road branch's error handler, and block `canGoNext`/surface it via `nextHint` on the stops step:

```typescript
routeUnreachable = signal(false);
```

```typescript
if (this.selectedType() === 'road') {
  this.routeLoading.set(true);
  this.routeError.set(false);
  this.routeUnreachable.set(false);
  this.plannerSvc.buildRoadRoute(valid)
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: coords => {
        this.plannerSvc.setRouteCoordinates(coords);
        this.routeLoading.set(false);
      },
      error: (err) => {
        this.plannerSvc.setRouteCoordinates([]);
        this.routeLoading.set(false);
        if (err instanceof Error && err.message === 'NO_ROAD_ROUTE') {
          this.routeUnreachable.set(true);
        } else {
          this.routeError.set(true);
        }
      },
    });
```

```typescript
readonly canGoNext = computed(() => {
  switch (this.currentStep()) {
    case 'stops':      return this.validStops().length >= 2 && !this.routeUnreachable();
    // ...unchanged
  }
});

readonly nextHint = computed<string | null>(() => {
  if (this.canGoNext()) return null;
  switch (this.currentStep()) {
    case 'stops':      return this.routeUnreachable() ? 'trip.planner.routeUnreachable' : 'trip.planner.hints.selectStops';
    // ...unchanged
  }
});
```

- `onTypeChange()` also resets `routeError`/`routeUnreachable` to `false` (previously neither was reset there — stale from a prior road attempt could otherwise linger after switching to rail and back).

`@frontend/src/app/features/trip-planner/trip-planner.html` — new branch alongside the existing `routeError` message, using `severity="error"` (stronger than the generic `warn`) since this one blocks progress:

```html
@if (routeLoading()) {
  <p-skeleton height="8px" borderRadius="4px" class="mt-3" />
} @else if (routeUnreachable()) {
  <p-message severity="error" class="w-full mt-2">
    {{ 'trip.planner.routeUnreachable' | translate }}
  </p-message>
} @else if (routeError()) {
  <p-message severity="warn" class="w-full mt-2">
    {{ 'trip.planner.routeError' | translate }}
  </p-message>
}
```

i18n — add `trip.planner.routeUnreachable` next to the existing `routeError` key in all four locales (en/de/fr/it), e.g. English: "We couldn't find a road close enough to this destination. Try a different stop."

---

## 7. Pre-filled 'to' stop (item 5) is locked

The road-trip prefill from item 5 fills the 'to' `p-autoComplete` with a normal, editable `TripStop`. Since mountain/lake/glacier names aren't searchable (that's the whole reason item 5 exists), clearing or retyping that field is a dead end — the user can only recover it by leaving the planner and re-entering via "Plan a Trip". Lock it instead: the user already chose this destination by navigating there.

`@frontend/src/app/features/trip-planner/trip-planner.ts`:

```typescript
destinationLocked = signal(false);
```

- Set `true` right after seeding the stop in the road-prefill branch of the constructor effect (see item 5); reset to `false` in `onTypeChange()` alongside the other stop-related resets (stops are cleared there anyway, so nothing stays locked across a type switch).

`@frontend/src/app/features/trip-planner/trip-planner.html` — extend the existing `isRoundTrip()`-based disable/hide conditions (same pattern already used to lock the mirrored stop in round-trip mode) to also cover a locked destination:

```html
[disabled]="(isRoundTrip() || destinationLocked()) && $index === stops().length - 1"
```

```html
[class.stop-action--hidden]="!(stops().length > 2 && $index > 0 && !($index === stops().length - 1 && (isRoundTrip() || destinationLocked())))"
```

This disables typing/clearing on the autocomplete and hides the remove-stop button for that row, while leaving it fully editable for the ordinary city-break flow (`destinationLocked` only ever becomes `true` via the item-5 prefill path).

---

## Out of Scope

- The rail half of item 5 (nearest-station lookup for destinations with no real station) — not implemented here, still being discussed.
- `AllAttractions`'s own marker population, search, and infinite-scroll logic are unchanged.
- `TripPlannerLayout`'s "back to destination" button and its own map markers are unrelated to this spec and untouched.

---

## References

- @frontend/src/app/shared/services/attraction-markers.ts
- @frontend/src/app/features/attractions/attraction-vertical-list/attraction-vertical-list.ts
- @frontend/src/app/features/attractions/attraction-vertical-list/attraction-vertical-list.html
- @frontend/src/app/shell/destinations-layout/destinations-layout.ts
- @frontend/src/app/shell/destinations-layout/destinations-layout.html
- @frontend/src/app/shared/drawer-host/drawer-host.ts
- @frontend/src/app/shared/drawer-host/drawer-host.html
- @frontend/src/app/shared/map/map.css
- @frontend/src/app/features/destinations/destination-detail/destination-detail.css
- @frontend/src/app/features/destinations/destination-horizontal-list/destination-horizontal-list.ts
- @frontend/src/app/features/destinations/destination-horizontal-list/destination-horizontal-list.html
- @frontend/src/app/features/home/home.html
- @frontend/src/app/features/destinations/destination-vertical-list/destination-vertical-list.ts
- @frontend/src/app/features/destinations/destination-vertical-list/destination-vertical-list.html
- @frontend/src/app/models/destination-category.ts
- @frontend/src/app/shell/trip-planner-layout/trip-planner-layout.ts
- @frontend/src/app/features/trip-planner/trip-planner.ts
- @frontend/src/app/features/trip-planner/trip-planner.html
- @frontend/src/app/shared/services/trip-planner.ts
- @frontend/src/app/shared/services/transport.ts
- @frontend/src/app/models/trip.ts
- @frontend/public/i18n/en.json (and de/fr/it)
- @context/features/destin-attrac-fixes-spec.md
- @context/features/home-categories-spec.md
