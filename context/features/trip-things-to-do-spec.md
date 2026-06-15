# Trip Planner — "Things to Do" Picker

## Overview

Lets users browse attractions near each trip stop and select which ones to bring along on the trip. Each filled stop in the Trip Planner drawer gets an `+ Add things to do` link; tapping it opens a stacked picker drawer scoped to that stop. Selections commit immediately (checkbox = saved state) and are included in the trip's `attractionIds` when the trip is saved.

This supersedes the never-finished "Attractions Along Route" section (Section 3b) from `trip-planner-spec.md` — that section was removed mid-implementation. The per-stop picker replaces it.

---

## Interaction Pattern

1. **Trigger** — each filled stop row in Section 2 (Stop Builder) gains a secondary line below the input:
   - No selections yet: `+ Add things to do` (link style, icon `fa-light fa-map-pin`)
   - N selected: `{{count}} things to do` (icon `fa-solid fa-circle-check`)
2. **Picker drawer** (`things-to-do`) opens stacked on top of `trip-planner` (third drawer level). Header shows the stop name and a close `X`.
3. **List** — each nearby attraction is a row: checkbox (left, immediate commit), 56×56 thumbnail, name + category tag, chevron (right).
4. **Expand** — tapping the chevron or row body (not the checkbox) expands that row accordion-style (auto-collapsing any other expanded row) to show a larger photo, abstract text, and a `View full details` link.
5. **View full details** opens `attraction-detail` as a fourth drawer level. Its back button returns to `things-to-do` for the same stop.
6. **Done** — a sticky footer button just closes the picker; checkboxes already committed their state on tap.
7. **Save** — Section 4's save flattens all per-stop selections (deduplicated) into `SavedTrip.attractionIds`.

---

## Models

### `frontend/src/app/models/trip.ts`

Add a new field to `PlannedTrip`:

```typescript
export interface PlannedTrip {
  type: 'road' | 'rail';
  stops: TripStop[];
  name?: string;
  connections?: TripConnection[];
  selectedConnection?: TripConnection;
  attractions?: Attraction[];
  routeCoordinates?: [number, number][];
  attractionSelections?: Record<string, string[]>; // stationId -> selected attraction identifiers
}
```

No change to `SavedTrip` — `attractionIds: string[]` already exists and is the flattened/deduplicated form of `attractionSelections`.

---

## Frontend Services

### `TripPlannerService` — `frontend/src/app/shared/services/trip-planner.ts`

Add selection state management (immediate-commit, keyed by `TripStop.stationId`):

```typescript
toggleAttraction(stationId: string, attractionId: string): void {
  const current = this._trip$.value.attractionSelections ?? {};
  const selected = new Set(current[stationId] ?? []);
  selected.has(attractionId) ? selected.delete(attractionId) : selected.add(attractionId);
  this._trip$.next({
    ...this._trip$.value,
    attractionSelections: { ...current, [stationId]: [...selected] },
  });
}

getSelections(stationId: string): string[] {
  return this._trip$.value.attractionSelections?.[stationId] ?? [];
}

allSelectedAttractionIds(): string[] {
  const sel = this._trip$.value.attractionSelections ?? {};
  return [...new Set(Object.values(sel).flat())];
}
```

`setStops()` prunes selections for stops that no longer exist:

```typescript
setStops(stops: TripStop[]): void {
  const ids = new Set(stops.map(s => s.stationId));
  const current = this._trip$.value.attractionSelections ?? {};
  const pruned = Object.fromEntries(Object.entries(current).filter(([k]) => ids.has(k)));
  this._trip$.next({ ...this._trip$.value, stops, attractionSelections: pruned });
}
```

`setType()` and `reset()` already replace the whole trip object, so `attractionSelections` is cleared implicitly — no change needed there.

**Hydration for loaded trips** — `SavedTrip.attractionIds` is flat, with no per-stop breakdown. On `loadSavedTrip()`, stash the saved IDs; the picker reconciles them against each stop's nearby-attraction list the first time it opens for that stop:

```typescript
private pendingAttractionIds = new Set<string>();

loadSavedTrip(trip: SavedTrip): void {
  this._trip$.next({
    type: trip.type,
    stops: trip.stops,
    routeCoordinates: trip.routeCoordinates,
    name: trip.name,
  });
  this._routeCoordinates$.next(trip.routeCoordinates);
  this.pendingAttractionIds = new Set(trip.attractionIds ?? []);
}

hydrateSelections(stationId: string, nearbyAttractionIds: string[]): void {
  if (this.pendingAttractionIds.size === 0) return;
  const matched = nearbyAttractionIds.filter(id => this.pendingAttractionIds.has(id));
  if (matched.length === 0) return;
  const current = this._trip$.value.attractionSelections ?? {};
  this._trip$.next({
    ...this._trip$.value,
    attractionSelections: {
      ...current,
      [stationId]: [...new Set([...(current[stationId] ?? []), ...matched])],
    },
  });
}
```

> **Known v1 limitation**: badge counts for a freshly-loaded saved trip read 0 until the picker has been opened for that stop at least once (that's when hydration runs). Acceptable for v1 — flag if it needs to be eager-loaded later.

### `AttractionsService` — `frontend/src/app/shared/services/attractions.ts`

Make `placeId` optional and add an optional `geoDist` param to `getAttractions()`:

```typescript
getAttractions(params: {
  language: string;
  page: number;
  hitsPerPage: number;
  placeId?: string;
  geoDist?: string; // "lat,lon,radiusMeters"
}): Observable<AttractionsPage> {
  let httpParams = new HttpParams()
    .set('language', params.language)
    .set('page', params.page)
    .set('hitsPerPage', params.hitsPerPage)
    .set('expand', 'false')
    .set('translate', 'true')
    .set('stripHtml', 'false');
  if (params.placeId) httpParams = httpParams.set('placeId', params.placeId);
  if (params.geoDist) httpParams = httpParams.set('geo.dist', params.geoDist);

  return this.http
    .get<AttractionsResponse>(this.baseUrl + '/attractions', { params: httpParams })
    .pipe(map(res => ({
      attractions: res.data.data,
      totalElements: res.data.meta?.page?.totalElements ?? 0,
    })));
}
```

Add a convenience method for the picker:

```typescript
getAttractionsNearby(lat: number, lon: number, language: string, hitsPerPage = 20): Observable<Attraction[]> {
  return this.getAttractions({ language, page: 0, hitsPerPage, geoDist: `${lat},${lon},10000` })
    .pipe(map(page => page.attractions));
}
```

10km radius matches the original Section 3b decision.

---

## Backend

### `getAttractions` controller — `backend/src/controllers/myswitzerland.js`

`placeId` becomes optional, and a new optional `geo.dist` passthrough is added:

```javascript
export const getAttractions = asyncHandler(async (req, res, next) => {
  const placeIdParam = req.query.placeId ? `&placeId=${encodeURIComponent(req.query.placeId)}` : '';
  const geoDistParam = req.query['geo.dist'] ? `&geo.dist=${encodeURIComponent(req.query['geo.dist'])}` : '';
  const config = {
    method: 'get',
    url: `${process.env.MYS_ENDPOINT}/v1/attractions/?lang=${req.query.language}&page=${req.query.page}&hitsPerPage=${req.query.hitsPerPage}${placeIdParam}${geoDistParam}&facets.translate=${req.query.translate}&expand=${req.query.expand}&striphtml=${req.query.stripHtml}`,
    headers: {
      'x-api-key': process.env.MYS_KEY,
      accept: 'application/json'
    },
  };
  try {
    let response = await axios(config);
    if (!response.data) {
      return next(new ErrorResponse(`No attraction data found`, 404));
    }
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    console.error(error);
    next(new ErrorResponse(`An error occurred during the request: ${error}`, 500));
  }
});
```

No route changes — `/api/v1/myswitzerland/attractions` already exists.

---

## New Component — `ThingsToDo`

### `frontend/src/app/features/trip-planner/things-to-do/things-to-do.ts`

```typescript
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, switchMap } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { Checkbox } from 'primeng/checkbox';
import { Tag } from 'primeng/tag';
import { Button } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { Drawer } from '../../../shared/services/drawer';
import { AttractionsService } from '../../../shared/services/attractions';
import { TripPlannerService } from '../../../shared/services/trip-planner';
import { LangService } from '../../../shared/services/lang';
import { Attraction } from '../../../models/attraction';
import { TripStop } from '../../../models/trip';

@Component({
  selector: 'app-things-to-do',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, Checkbox, Tag, Button, Skeleton],
  templateUrl: './things-to-do.html',
  styleUrl: './things-to-do.css',
})
export class ThingsToDo {
  private drawerSvc = inject(Drawer);
  private attractionsSvc = inject(AttractionsService);
  private plannerSvc = inject(TripPlannerService);
  private langSvc = inject(LangService);
  private destroyRef = inject(DestroyRef);

  stop = computed(() => {
    this.drawerSvc.list();
    return this.drawerSvc.getPayload<{ stop: TripStop }>('things-to-do')?.stop ?? null;
  });

  attractions = signal<Attraction[]>([]);
  loading = signal(false);
  expandedId = signal<string | null>(null);

  private fetchTrigger$ = new Subject<{ stop: TripStop; lang: string }>();

  constructor() {
    this.fetchTrigger$.pipe(
      switchMap(({ stop, lang }) => {
        this.loading.set(true);
        return this.attractionsSvc.getAttractionsNearby(stop.lat, stop.lon, lang).pipe(
          map => [stop, map] as const, // see note below — keep stop alongside result
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(([stop, attractions]) => {
      this.attractions.set(attractions);
      this.loading.set(false);
      this.plannerSvc.hydrateSelections(stop.stationId, attractions.map(a => a.identifier));
    });

    effect(() => {
      const stop = this.stop();
      this.expandedId.set(null);
      if (!stop) { this.attractions.set([]); return; }
      const lang = this.langSvc.current;
      untracked(() => this.fetchTrigger$.next({ stop, lang }));
    });
  }

  isSelected(attractionId: string): boolean {
    const stop = this.stop();
    return !!stop && this.plannerSvc.getSelections(stop.stationId).includes(attractionId);
  }

  toggle(attractionId: string): void {
    const stop = this.stop();
    if (!stop) return;
    this.plannerSvc.toggleAttraction(stop.stationId, attractionId);
  }

  toggleExpand(attractionId: string): void {
    this.expandedId.set(this.expandedId() === attractionId ? null : attractionId);
  }

  categoryTag(attraction: Attraction): string | null {
    return attraction.classification?.[0]?.values?.[0]?.title ?? null;
  }

  viewDetails(attraction: Attraction): void {
    const stop = this.stop();
    if (!stop) return;
    this.drawerSvc.open('attraction-detail', { attraction, stop, source: 'things-to-do' });
  }

  close(): void {
    this.drawerSvc.close('things-to-do');
  }
}
```

> Note: the `switchMap`/tuple wiring above is illustrative — implement with whatever combinator keeps `stop` available alongside the emitted attractions (e.g. `map(attractions => ({ stop, attractions }))` inside the inner pipe), following the same `Subject` + `switchMap` + `takeUntilDestroyed` shape as `AttractionDetail` (`frontend/src/app/features/attractions/attraction-detail/attraction-detail.ts`).

### `frontend/src/app/features/trip-planner/things-to-do/things-to-do.html`

```html
<div class="ttd-panel">
  @if (loading()) {
    @for (s of [1,2,3,4]; track s) {
      <p-skeleton height="72px" borderRadius="8px" styleClass="mb-2" />
    }
  } @else if (attractions().length === 0) {
    <p class="tp-empty">{{ 'trip.planner.thingsToDo.empty' | translate }}</p>
  } @else {
    <div class="attraction-list">
      @for (attraction of attractions(); track attraction.identifier) {
        <div class="ttd-card">
          <div class="attraction-row" (click)="toggleExpand(attraction.identifier)">
            <p-checkbox
              [binary]="true"
              [ngModel]="isSelected(attraction.identifier)"
              (ngModelChange)="toggle(attraction.identifier)"
              (click)="$event.stopPropagation()" />
            <img class="attraction-thumb" [src]="attraction.photo" [alt]="attraction.name" />
            <div class="attraction-info">
              <span class="attraction-name">{{ attraction.name }}</span>
              @if (categoryTag(attraction)) {
                <p-tag [value]="categoryTag(attraction)!" severity="secondary" class="attraction-tag" />
              }
            </div>
            <i class="fa-light fa-chevron-down attraction-arrow"
               [class.ttd-chevron--open]="expandedId() === attraction.identifier"></i>
          </div>

          @if (expandedId() === attraction.identifier) {
            <div class="ttd-expanded">
              <img class="ttd-expanded-photo" [src]="attraction.photo" [alt]="attraction.name" />
              @if (attraction.abstract) {
                <p class="ttd-description">{{ attraction.abstract }}</p>
              }
              <p-button
                [label]="'trip.planner.thingsToDo.viewDetails' | translate"
                [link]="true"
                icon="fa-light fa-arrow-up-right-from-square"
                (onClick)="viewDetails(attraction)" />
            </div>
          }
        </div>
      }
    </div>
  }
</div>

<div class="ttd-footer">
  <p-button
    [label]="'trip.planner.thingsToDo.done' | translate"
    styleClass="w-full"
    (onClick)="close()" />
</div>
```

### `frontend/src/app/features/trip-planner/things-to-do/things-to-do.css`

```css
:host {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.ttd-panel {
  flex: 1;
  overflow-y: auto;
  padding: 0 1rem;
}

.ttd-card {
  border-radius: 8px;
  overflow: hidden;
}

.ttd-chevron--open {
  transform: rotate(180deg);
  transition: transform 0.15s;
}

.ttd-expanded {
  padding: 0 0.5rem 0.75rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ttd-expanded-photo {
  width: 100%;
  height: 140px;
  object-fit: cover;
  border-radius: 8px;
  background: #e2e8f0;
}

.ttd-description {
  font-size: 0.85rem;
  color: #475569;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
}

.ttd-footer {
  flex-shrink: 0;
  padding: 0.75rem 1rem;
  border-top: 1px solid #e2e8f0;
  background: #fff;
}
```

Reuses `.attraction-list`, `.attraction-row`, `.attraction-thumb`, `.attraction-info`, `.attraction-name`, `.attraction-tag`, `.attraction-arrow`, `.tp-empty` already defined in `frontend/src/app/features/trip-planner/trip-planner.css` (leftover from the removed Section 3b — these classes are currently unused and can be reused here as-is). Either move them to a shared stylesheet or duplicate into `things-to-do.css`; either is fine, just avoid leaving dead copies in `trip-planner.css` once `things-to-do.css` has its own.

---

## Drawer Integration

### `DrawerService` — `frontend/src/app/shared/services/drawer.ts`

Add `'things-to-do'` to `DrawerKey`:

```typescript
export type DrawerKey =
  | 'menu-nav'
  | 'auth'
  | 'forgot-password'
  | 'destination-detail'
  | 'all-attractions'
  | 'attraction-detail'
  | 'weather'
  | 'language'
  | 'profile'
  | 'trip-planner'
  | 'things-to-do'
```

### `attraction-detail.ts` — `frontend/src/app/features/attractions/attraction-detail/attraction-detail.ts`

Extend the payload with an optional `stop` and a new `source` value:

```typescript
export interface AttractionDetailPayload {
  attraction: Attraction;
  destination?: Destination;
  stop?: TripStop;
  source: 'destination-detail' | 'all-attractions' | 'things-to-do';
}
```

(Add `import { TripStop } from '../../../models/trip';`, and make `destination` optional since it won't be set for the `things-to-do` source.)

### `DrawerHost` — `frontend/src/app/shared/drawer-host/drawer-host.ts`

Import and register `ThingsToDo`. Add a title computed and extend back-navigation:

```typescript
import { ThingsToDo } from '../../features/trip-planner/things-to-do/things-to-do';
import { TripStop } from '../../models/trip';

// in @Component imports array: add ThingsToDo

thingsToDoTitle = computed(() => {
  this.svc.list();
  const stop = this.svc.getPayload<{ stop: TripStop }>('things-to-do')?.stop;
  return stop?.name ?? '';
});

attractionDetailSource = computed(() => {
  this.svc.list();
  return this.svc.getPayload<AttractionDetailPayload>('attraction-detail')?.source;
});

onAttractionDetailBack() {
  const payload = this.svc.getPayload<AttractionDetailPayload>('attraction-detail')!;
  this.svc.close('attraction-detail');
  if (payload.source === 'things-to-do') {
    this.svc.open('things-to-do', { stop: payload.stop });
    return;
  }
  this.svc.open('all-attractions', payload.destination);
}
```

### `drawer-host.html` — `frontend/src/app/shared/drawer-host/drawer-host.html`

New drawer, registered alongside `trip-planner` (same width, same stacking conventions):

```html
<!-- THINGS TO DO -->
<p-drawer
    [visible]="svc.isOpen('things-to-do')"
    [closable]="false"
    [dismissible]="false"
    [closeOnEscape]="false"
    (visibleChange)="onVisibleChange('things-to-do', $event)"
    position="left"
    appendTo="body"
    [baseZIndex]="svc.zIndexFor('things-to-do')"
    [style]="{ width: 'min(480px, calc(100vw - 20px))' }"
    styleClass="dest-drawer">
    <ng-template #header>
        <div class="dest-header">
            <div class="menu-brand-text">
                <i class="fa-light fa-map-pin"></i>
                <span class="menu-brand-name">{{ thingsToDoTitle() }}</span>
            </div>
            <button class="menu-close" type="button" (click)="onDrawerClose('things-to-do')">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    </ng-template>
    <app-things-to-do></app-things-to-do>
</p-drawer>
```

Update the `attraction-detail` header's back button to vary by source (currently hardcoded to `'attractions.backToAttractions'`):

```html
<button class="dest-back" type="button" (click)="onAttractionDetailBack()">
    <i class="fa-sharp fa-solid fa-circle-arrow-left"></i>
    @if (attractionDetailSource() === 'things-to-do') {
        {{ 'trip.planner.thingsToDo.backToList' | translate }}
    } @else {
        {{ 'attractions.backToAttractions' | translate }}
    }
</button>
```

---

## Trip Planner Component Changes

### `frontend/src/app/features/trip-planner/trip-planner.ts`

```typescript
openThingsToDo(stop: TripStop): void {
  this.drawerSvc.open('things-to-do', { stop });
}

selectionCount(stationId: string): number {
  return this.plannerSvc.getSelections(stationId).length;
}
```

`onSave()` — populate `attractionIds` instead of `[]`:

```typescript
const trip: SavedTrip = {
  name,
  type: this.selectedType(),
  stops: valid,
  attractionIds: this.plannerSvc.allSelectedAttractionIds(),
  routeCoordinates: this.plannerSvc.snapshot.routeCoordinates ?? [],
};
```

### `frontend/src/app/features/trip-planner/trip-planner.html`

Restructure each `.stop-row` so the autocomplete + remove button sit in a `.stop-input-row`, with a new `.stop-things-row` beneath (only for filled stops):

```html
<div class="stop-row">
  <div class="stop-indicator">
    <!-- unchanged: start/end/mid icon + .stop-line -->
  </div>

  <div class="stop-main">
    <div class="stop-input-row">
      <p-autoComplete ... ></p-autoComplete>
      @if (stops().length > 2) {
        <p-button icon="fa-light fa-xmark" variant="text" severity="secondary" class="stop-remove" (onClick)="removeStop($index)" />
      }
    </div>

    @if (stop) {
      <div class="stop-things-row">
        <button type="button" class="stop-things-link" (click)="openThingsToDo(stop)">
          @if (selectionCount(stop.stationId) > 0) {
            <i class="fa-solid fa-circle-check"></i>
            <span>{{ 'trip.planner.thingsToDo.countLabel' | translate: { count: selectionCount(stop.stationId) } }}</span>
          } @else {
            <i class="fa-light fa-map-pin"></i>
            <span>{{ 'trip.planner.thingsToDo.add' | translate }}</span>
          }
        </button>
      </div>
    }
  </div>
</div>
```

### `frontend/src/app/features/trip-planner/trip-planner.css`

```css
.stop-row {
  display: flex;
  align-items: stretch; /* was flex-start — lets .stop-line fill the taller row */
  gap: 0.6rem;
}

.stop-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.stop-input-row {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
}

.stop-things-row {
  margin-top: 0.15rem;
}

.stop-things-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  color: var(--navy-500, #6b90b8);
  background: none;
  border: none;
  padding: 0.15rem 0;
  cursor: pointer;
}

.stop-things-link i {
  font-size: 0.85rem;
}
```

`.stop-indicator` is unchanged, but with `.stop-row` now `align-items: stretch`, `.stop-indicator` stretches to the full row height (including the new `.stop-things-row`), and `.stop-line`'s existing `flex: 1` fills that extra height automatically — the dashed connector keeps reaching the next stop's icon regardless of row height.

---

## Translation Keys

Add to all four locale files (`frontend/src/assets/i18n/en.json`, `de.json`, `fr.json`, `it.json`):

```
trip.planner.thingsToDo.add
trip.planner.thingsToDo.countLabel
trip.planner.thingsToDo.empty
trip.planner.thingsToDo.viewDetails
trip.planner.thingsToDo.backToList
trip.planner.thingsToDo.done
```

| Key | en | de | fr | it |
|---|---|---|---|---|
| `add` | Add things to do | Dinge zum Erleben hinzufügen | Ajouter des activités | Aggiungi attività |
| `countLabel` | {{count}} things to do | {{count}} Dinge zum Erleben | {{count}} activités | {{count}} attività |
| `empty` | No attractions found nearby | Keine Attraktionen in der Nähe gefunden | Aucune attraction trouvée à proximité | Nessuna attrazione trovata nelle vicinanze |
| `viewDetails` | View full details | Vollständige Details anzeigen | Voir tous les détails | Vedi tutti i dettagli |
| `backToList` | Back to things to do | Zurück zu den Aktivitäten | Retour aux activités | Torna alle attività |
| `done` | Done | Fertig | Terminé | Fine |

---

## Notes

- Map markers for nearby "things to do" candidates are **not** added to the map — only the existing numbered trip-stop markers remain. Keeps the route view uncluttered; can revisit later if users want to see candidates plotted.
- Checkbox selection is per-stop (`attractionSelections[stationId]`). If the same attraction is near two stops, it can be independently selected from either picker; on save, duplicates collapse via `allSelectedAttractionIds()`.
- 10km search radius and `hitsPerPage: 20` are starting points — easy to tune without changing the data flow.
- The accordion expand is one-at-a-time (`expandedId` signal) to avoid runaway list growth on mobile.
- Use primeng components where best suited. This is optional.

---

## References

- @context/features/trip-planner-spec.md
- @context/features/trip-planner-layout-spec.md
- @frontend/src/app/shared/services/drawer.ts
- @frontend/src/app/shared/drawer-host/drawer-host.ts
- @frontend/src/app/shared/drawer-host/drawer-host.html
- @frontend/src/app/shared/services/trip-planner.ts
- @frontend/src/app/shared/services/attractions.ts
- @frontend/src/app/features/trip-planner/trip-planner.ts
- @frontend/src/app/features/trip-planner/trip-planner.html
- @frontend/src/app/features/trip-planner/trip-planner.css
- @frontend/src/app/features/attractions/attraction-detail/attraction-detail.ts
- @frontend/src/app/models/trip.ts
- @frontend/src/app/models/attraction.ts
- @backend/src/controllers/myswitzerland.js
