# Destination & Attraction Fixes

## Overview

Six fixes across the homepage destination cards, the "view all" destinations list, the destination-detail action grid, attraction list labelling, and the attraction-selection/map-zoom behaviour on the destination map page.

---

## 1. Homepage destination cards route to destination-detail

`@frontend/src/app/features/destinations/destination-horizontal-list/destination-horizontal-list.html`:

- Change the `.destination-card` from a `<div>` to an `<a>` with `[routerLink]="['/destinations', dest.identifier]"` — the same target the "view all" cards route to (`/destinations/:id` → `DestinationsLayout`, which opens the `destination-detail` drawer).

```html
@for (dest of destinations; track dest.identifier) {
  <a class="destination-card" [routerLink]="['/destinations', dest.identifier]" [style.background-image]="'url(' + dest.photo + ')'">
    <span class="card-type">{{ cardTitle }}</span>
    <span class="card-name">{{ dest.name }}</span>
  </a>
}
```

`RouterLink` is already imported in `DestinationHorizontalList`'s `imports`, no TS changes needed.

`@frontend/src/app/features/destinations/destination-horizontal-list/destination-horizontal-list.css`:

- Add `text-decoration: none; color: inherit;` to `.destination-card` so it doesn't pick up default anchor styling (flex layout already applies fine to `<a>`).

---

## 2. "View all" destination cards: remove coords + "Let's Visit", route whole card

`@frontend/src/app/features/destinations/destination-vertical-list/destination-vertical-list.html`:

- Remove the `.card-coords` button (and the `dest.geo.latitude && dest.geo.longitude` check around it).
- Remove the `.visit-btn` ("Let's Visit") link.
- Convert the outer `.destination-card` `<div>` to an `<a>` with `[routerLink]="['/destinations', dest.identifier]"`, so the entire card is clickable.
- Remove `[activeMarker]="activeMarker()"` from the `<app-map>` binding (the map on this page no longer needs an active marker).

```html
<app-map [markers]="mapMarkers()" [zoom]="6"></app-map>
...
@for (dest of destinations; track dest.identifier) {
  <a class="destination-card" [routerLink]="['/destinations', dest.identifier]">
    <div class="card-photo" [style.background-image]="'url(' + dest.photo + ')'">
      <span class="card-type">{{ cardTitle }}</span>
      <span class="card-name">{{ dest.name }}</span>
    </div>
    <div class="card-text">
      <p class="card-abstract">{{ dest.abstract }}</p>
    </div>
  </a>
}
```

`@frontend/src/app/features/destinations/destination-vertical-list/destination-vertical-list.ts`:

- Remove `selectMarker()`, `formatCoords()`, and the `activeMarker` signal (all coordinate-related logic).
- `MapMarker`/`mapMarkers` signal stay (still needed for the map's marker pins).

`@frontend/src/app/features/destinations/destination-vertical-list/destination-vertical-list.css`:

- Remove `.card-coords` rule and the `.card-coords` portion of the shared `.card-type, .card-coords` selector (keep `.card-type` on its own).
- Remove `.visit-btn` and `.visit-btn:hover`.
- Add `text-decoration: none; color: inherit; cursor: pointer;` to `.destination-card`.

i18n — `destinations.letsVisit` becomes unused; remove it from all four locale files (en/de/fr/it).

---

## 3. "Plan a Trip" button → card matching the weather card

`@frontend/src/app/features/destinations/destination-detail/destination-detail.html`, inside `.action-grid`:

- Replace the `<button class="plan-btn">` with an `<a class="plan-card" [routerLink]="['/trip-planner', dest.identifier]">`.
- Add a second line of text: `{{ 'destinations.detail.planTripSubtitle' | translate }}` ("By road or rail") below "Plan a Trip".

```html
<a class="plan-card" [routerLink]="['/trip-planner', dest.identifier]">
  <i class="fa-solid fa-route plan-card-icon"></i>
  <div class="plan-card-text">
    <span class="plan-card-title">{{ 'destinations.detail.planTrip' | translate }}</span>
    <span class="plan-card-subtitle">{{ 'destinations.detail.planTripSubtitle' | translate }}</span>
  </div>
</a>
```

`@frontend/src/app/features/destinations/destination-detail/destination-detail.ts`:

- Remove `openTripPlanner()` and the `Router` injection (now unused — routing is handled by `routerLink`).

`@frontend/src/app/features/destinations/destination-detail/destination-detail.css`:

- Replace `.plan-btn`/`.plan-btn:hover` with `.plan-card`, matching `.weather-box`'s `border-radius: 12px` and `min-height: 80px`, keeping the existing navy theme:

```css
.plan-card {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 80px;
  border-radius: 12px;
  padding: 0.75rem 1rem;
  background: var(--navy-900);
  color: var(--color-white);
  text-decoration: none;
  transition: background 0.2s;
}

.plan-card:hover {
  background: var(--navy-700);
}

.plan-card-icon {
  font-size: 1.2rem;
}

.plan-card-text {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.plan-card-title {
  font-size: 0.95rem;
  font-weight: 700;
}

.plan-card-subtitle {
  font-size: 0.7rem;
  opacity: 0.85;
}
```

i18n — add `destinations.detail.planTripSubtitle`:

| Locale | Value |
| --- | --- |
| en | By road or rail |
| de | Mit Auto oder Bahn |
| fr | En voiture ou en train |
| it | In auto o in treno |

---

## 4. "Top attractions" → "Popular attractions"

`@frontend/public/i18n/*.json` — update `attractions.title`:

| Locale | Old | New |
| --- | --- | --- |
| en | Top attractions | Popular attractions |
| de | Top-Attraktionen | Beliebte Attraktionen |
| fr | Meilleures attractions | Attractions populaires |
| it | Attrazioni principali | Attrazioni popolari |

(`attractions.titleFallback` "Attractions" is unaffected.)

---

## 5. Clicking an attraction no longer opens the drawer

Currently both `AttractionVerticalList.onAttractionClick()` (used inside `destination-detail`) and `AllAttractions.onAttractionClick()` (used inside the `all-attractions` drawer, including search results) close their host drawer and open `attraction-detail`.

`@frontend/src/app/features/attractions/attraction-vertical-list/attraction-vertical-list.ts`:

```typescript
onAttractionClick(attraction: Attraction): void {
  this.attractionMarkers.setSelected(attraction.identifier);
}
```

(`Drawer`/`drawerSvc` is still needed for `onSeeAll()`, keep that injection.)

`@frontend/src/app/features/attractions/all-attractions/all-attractions.ts`:

```typescript
onAttractionClick(attraction: Attraction): void {
  this.attractionMarkers.setSelected(attraction.identifier);
}
```

(`Drawer`/`drawerSvc` is still needed for the `destination` computed, keep that injection.)

The `attraction-detail` drawer continues to open only via the map marker's popup label — `MapComponent`'s clickable popup button already emits `markerClick`, handled by `DestinationsLayout.onMarkerClick()`, which opens `attraction-detail`. No change needed there.

---

## 6. Map zoom in/out on attraction select/deselect

**Select (click an attraction card):** `setSelected(id)` from #5 updates `AttractionMarkersService.selectedId`, which feeds `DestinationsLayout.selectedMarker()` → `app-map`'s `[activeMarker]`. The map should fly to that marker at a closer zoom (already implemented as zoom `15` in `MapComponent.activateMarker()`), and remember the view it had *before* zooming in.

`@frontend/src/app/shared/map/map.ts`:

- Add a `previousView` field capturing the map's current center/zoom the first time `activateMarker()` runs (don't overwrite it on subsequent selections, so repeated attraction clicks always restore to the original view).
- Add `deactivateMarker()` that flies back to `previousView` and clears it.
- In `ngOnChanges`, when `activeMarker` changes to a falsy value, call `deactivateMarker()` instead of doing nothing:

```typescript
private previousView?: { center: maplibregl.LngLat; zoom: number };

private activateMarker(target: { lng: number; lat: number }): void {
  if (!this.previousView && this.map) {
    this.previousView = { center: this.map.getCenter(), zoom: this.map.getZoom() };
  }
  // ...existing flyTo(zoom: 15) + popup logic unchanged
}

private deactivateMarker(): void {
  if (!this.map || !this.previousView) return;
  this.map.flyTo({ center: this.previousView.center, zoom: this.previousView.zoom, duration: 800 });
  this.previousView = undefined;
}
```

```typescript
if (changes['activeMarker'] && this.mapLoaded) {
  if (this.activeMarker) {
    this.activateMarker(this.activeMarker);
  } else {
    this.deactivateMarker();
  }
}
```

**Deselect (Back to destination / Open destination / Open attractions):** these three actions should clear the selected attraction so the map flies back to `previousView`:

- `@frontend/src/app/shared/drawer-host/drawer-host.ts` `onAllAttractionsBack()` ("Back to destination" on the `all-attractions` drawer) — inject `AttractionMarkersService` and call `setSelected(null)`.
- `@frontend/src/app/shell/destinations-layout/destinations-layout.ts` `openDetail()` ("Open destination" reopen button) — call `this.attractionMarkers.setSelected(null)`.
- `@frontend/src/app/shell/destinations-layout/destinations-layout.ts` `reopenAllAttractions()` ("Open attractions" reopen button) — call `this.attractionMarkers.setSelected(null)`.

`AttractionDetail.ngOnDestroy()` already calls `setSelected(null)` when the attraction-detail drawer (opened via marker click, per #5) closes — this composes with the same `deactivateMarker()` mechanism, so no change needed there.

---

## Out of Scope

- `DrawerHost.attractionDetailBackKey` / the `attraction-detail` drawer's back-button label and `onAttractionDetailBack()` source-routing (`'destination-detail'` vs `'all-attractions'`) are unchanged — this is a pre-existing inconsistency not addressed here.
- `mapSectionRef`/`ViewChild` in `DestinationVerticalList` is unused and unrelated to the coordinate cleanup in #2; left as-is.
- No changes to the trip-planner drawer, weather drawer, or their "Back to destination" buttons.

---

## References

- @frontend/src/app/features/destinations/destination-horizontal-list/destination-horizontal-list.html
- @frontend/src/app/features/destinations/destination-horizontal-list/destination-horizontal-list.css
- @frontend/src/app/features/destinations/destination-vertical-list/destination-vertical-list.html
- @frontend/src/app/features/destinations/destination-vertical-list/destination-vertical-list.ts
- @frontend/src/app/features/destinations/destination-vertical-list/destination-vertical-list.css
- @frontend/src/app/features/destinations/destination-detail/destination-detail.html
- @frontend/src/app/features/destinations/destination-detail/destination-detail.ts
- @frontend/src/app/features/destinations/destination-detail/destination-detail.css
- @frontend/src/app/features/attractions/attraction-vertical-list/attraction-vertical-list.ts
- @frontend/src/app/features/attractions/all-attractions/all-attractions.ts
- @frontend/src/app/shell/destinations-layout/destinations-layout.ts
- @frontend/src/app/shared/drawer-host/drawer-host.ts
- @frontend/src/app/shared/map/map.ts
- @frontend/public/i18n/en.json (and de/fr/it)
