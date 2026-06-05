# Trip Planner

## Overview

A drawer experience that allows users to plan a road or rail journey through Switzerland. Users search for stops using the Swiss transport network, view the route on the map, discover nearby attractions, and save their trip to their profile. Accessible from both the home page hero CTA and the destination detail page. Designed to work seamlessly on mobile and desktop using PrimeNG 21 components throughout.

---

## Models

### Frontend Models — `@frontend/src/app/models/trip.ts`

Create a new model file with the following interfaces:

```typescript
export interface TripStop {
  stationId: string;       // transport.opendata.ch location id
  name: string;
  lat: number;
  lon: number;
}

export interface TripConnection {
  from: string;
  to: string;
  departure: string;       // ISO datetime string
  arrival: string;         // ISO datetime string
  duration: string;        // e.g. "01d28:00"
  transfers: number;
  products: string[];      // e.g. ["IC", "IR"]
}

export interface PlannedTrip {
  type: 'road' | 'rail';
  stops: TripStop[];
  connections?: TripConnection[];
  selectedConnection?: TripConnection;
  attractions?: Attraction[];
  routeCoordinates?: [number, number][];  // [lon, lat] pairs for map line
}

export interface SavedTrip {
  _id?: string;
  name: string;
  type: 'road' | 'rail';
  stops: TripStop[];
  attractionIds: string[];
  routeCoordinates: [number, number][];
  createdAt?: string;
}
```

Import `Attraction` from `@frontend/src/app/models/attraction.ts`.

---

### Backend Model — `@backend/src/models/Trip.js`

Create a new Mongoose model:

```javascript
const TripStopSchema = {
  stationId: { type: String, required: true },
  name: { type: String, required: true },
  lat: { type: Number, required: true },
  lon: { type: Number, required: true }
};

const TripSchema = {
  user: { type: ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['road', 'rail'], required: true },
  stops: { type: [TripStopSchema], required: true },
  attractionIds: [String],
  routeCoordinates: [[Number]],
  createdAt: { type: Date, default: Date.now }
};
```

---

## Backend Requirements

### Trips Controller and Routes — `@backend/src/routes/trips.js`

Create protected CRUD endpoints (all require JWT authentication via the existing `protect` middleware):

- `GET /api/v1/trips` — Returns all trips for the authenticated user. Query by `user: req.user.id`.
- `POST /api/v1/trips` — Creates a new trip. Body: `{ name, type, stops, attractionIds, routeCoordinates }`. Sets `user` from `req.user.id`.
- `PUT /api/v1/trips/:id` — Updates a trip. Must verify `trip.user === req.user.id` before updating.
- `DELETE /api/v1/trips/:id` — Deletes a trip. Must verify `trip.user === req.user.id` before deleting.

Register the router in `@backend/src/server.js` as `/api/v1/trips`.

---

## Frontend Services

### TransportService — `@frontend/src/app/shared/services/transport.ts`

Calls the backend proxy endpoints provided separately. Methods:

- `searchLocations(query: string): Observable<TripStop[]>` — GET `{apiUrl}/api/v1/transport/locations?query={query}`. Map the response array to `TripStop[]` extracting `id → stationId`, `name`, `coordinate.x → lon`, `coordinate.y → lat`.
- `getConnections(stops: TripStop[], date: string, time: string): Observable<TripConnection[]>` — GET `{apiUrl}/api/v1/transport/connections` with params: `from={stops[0].name}`, `to={stops[last].name}`, `via={stops[1..n-1].name}` (comma-separated), `date`, `time`. Map response `connections[]` to `TripConnection[]` extracting `from.departure`, `to.arrival`, `duration`, `transfers`, `products`.

### TripPlannerService — `@frontend/src/app/shared/services/trip-planner.ts`

Manages in-progress trip state using RxJS BehaviorSubjects. Expose as Observables:

- `trip$: Observable<PlannedTrip>` — the full current trip state
- `routeCoordinates$: Observable<[number, number][]>` — emits whenever the route line should update on the map; used by `DestinationsLayout` to pass data to the map

Methods:
- `setType(type: 'road' | 'rail'): void`
- `setStops(stops: TripStop[]): void`
- `setConnections(connections: TripConnection[]): void`
- `selectConnection(connection: TripConnection): void` — updates `selectedConnection` and rebuilds `routeCoordinates` from the connection's intermediate station coordinates
- `setAttractions(attractions: Attraction[]): void`
- `buildRoadRoute(stops: TripStop[]): Observable<[number, number][]>` — calls OSRM public API: `http://router.project-osrm.org/route/v1/driving/{coordinates}?overview=full&geometries=geojson` where coordinates are `lon,lat;lon,lat` pairs. Extract `routes[0].geometry.coordinates`.
- `buildRailRoute(stops: TripStop[]): [number, number][]` — returns straight-line coordinates: `stops.map(s => [s.lon, s.lat])`
- `reset(): void` — resets trip to initial state

### TripsService — `@frontend/src/app/shared/services/trips.ts`

CRUD against `/api/v1/trips`. Methods:

- `getTrips(): Observable<SavedTrip[]>`
- `saveTrip(trip: SavedTrip): Observable<SavedTrip>`
- `updateTrip(id: string, trip: Partial<SavedTrip>): Observable<SavedTrip>`
- `deleteTrip(id: string): Observable<void>`

---

## Drawer Registration

### Update DrawerService — `@frontend/src/app/shared/services/drawer.ts`

Add `'trip-planner'` to the drawer key union type.

### Update DrawerHost — `@frontend/src/app/shared/drawer-host/drawer-host.ts` and `drawer-host.html`

Register and render the `TripPlannerComponent` in the drawer host following the same pattern as other drawers:

```html
<p-drawer
    [visible]="svc.isOpen('trip-planner')"
    [closable]="false"
    [dismissible]="false"
    [closeOnEscape]="false"
    (visibleChange)="onVisibleChange('trip-planner', $event)"
    position="left"
    appendTo="body"
    [baseZIndex]="svc.zIndexFor('trip-planner')"
    [style]="{ width: 'min(480px, calc(100vw - 20px))' }"
    styleClass="dest-drawer">
    <ng-template #header>
        <div class="dest-header">
            <div class="menu-brand-text">
                <i class="fa-light fa-route"></i>
                <span class="menu-brand-name">{{ 'trip.planner.title' | translate }}</span>
            </div>
            <button class="menu-close" type="button" (click)="onDrawerClose('trip-planner')">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    </ng-template>
    <app-trip-planner></app-trip-planner>
</p-drawer>
```

---

## Trip Planner Drawer Component

### Create `@frontend/src/app/features/trip-planner/trip-planner.ts` and `trip-planner.html`

Import all required PrimeNG modules as standalone imports: `SelectButtonModule`, `AutoCompleteModule`, `DatePickerModule`, `InputTextModule`, `ButtonModule`, `DividerModule`, `SkeletonModule`, `TagModule`, `ChipModule`, `ToastModule`, `ConfirmDialogModule`, `FloatLabelModule`, `MessageModule`.

The drawer body is a single scrollable column. Use `p-divider` between each major section.

---

### Section 1 — Trip Type Toggle

Use `p-selectButton` with two options: `Road Trip` (value `'road'`) and `Rail Trip` (value `'rail'`). Apply `styleClass="trip-type-toggle"` and set `[allowEmpty]="false"` so one option is always selected. Default to `'road'`. Bind to `selectedType` signal. On change call `tripPlannerService.setType()` and reset all stops.

```html
<p-selectButton
    [options]="tripTypes"
    [(ngModel)]="selectedType"
    [allowEmpty]="false"
    styleClass="trip-type-toggle w-full">
    <ng-template #item let-opt>
        <i [class]="opt.icon"></i>
        <span>{{ opt.label | translate }}</span>
    </ng-template>
</p-selectButton>
```

Road Trip icon: `fa-light fa-car-side`. Rail Trip icon: `fa-light fa-train`.

---

### Section 2 — Stop Builder

Render a vertical list of stop rows using `@for`. Each row contains:

- A sequence indicator on the left: a small numbered circle for intermediate stops (`2`, `3`, etc.), a start pin `fa-light fa-circle-dot` for the first stop, and a destination pin `fa-light fa-location-dot` for the last stop. These are connected by a dashed vertical line using CSS pseudo-elements to visually suggest a route.
- A `p-autoComplete` input using `TransportService.searchLocations()` for suggestions. Apply `[showEmptyMessage]="true"`, `[minLength]="3"`, `[delay]="300"`, `[forceSelection]="true"`, and `styleClass="stop-input w-full"`. Display `name` in the dropdown template. On `onSelect` store the full `TripStop` object.
- A remove button using `p-button` with `icon="fa-light fa-xmark"`, `[text]="true"`, `severity="secondary"`. Hide this button on rows 1 and 2 when only 2 stops exist.

Below the stop list, an `+ Add stop` link rendered as `p-button` with `[link]="true"`, icon `fa-light fa-plus`, and label `{{ 'trip.planner.addStop' | translate }}`. Maximum 8 stops.

When all stops are filled and valid (≥ 2 stops with coordinates):
- **Road Trip**: automatically call `tripPlannerService.buildRoadRoute()`. Show a `p-skeleton` in the map area while OSRM is loading (height 40px, width 100%, `borderRadius="4px"`).
- **Rail Trip**: show Section 3a below.

---

### Section 3a — Rail Connections (Rail Trip only, shown when ≥ 2 stops filled)

Use `p-inputGroup` to lay out the date picker, time input, and find button on one row on desktop, and stacked on mobile:

```html
<div class="connections-form">
    <p-floatLabel class="connections-date">
        <p-datePicker inputId="conn-date" [(ngModel)]="connDate"
            dateFormat="dd/mm/yy" [minDate]="today" [showIcon]="true"
            icon="fa-light fa-calendar" styleClass="w-full" />
        <label for="conn-date">{{ 'trip.planner.date' | translate }}</label>
    </p-floatLabel>
    <p-floatLabel class="connections-time">
        <input pInputText id="conn-time" [(ngModel)]="connTime"
            placeholder="HH:MM" class="w-full" />
        <label for="conn-time">{{ 'trip.planner.time' | translate }}</label>
    </p-floatLabel>
    <p-button
        [label]="'trip.planner.findConnections' | translate"
        icon="fa-light fa-magnifying-glass"
        styleClass="connections-btn"
        (onClick)="findConnections()" />
</div>
```

On mobile (< 768px): date picker and time input stack as full-width rows, button below them full-width.

Display returned connections as a list. Each connection row shows:
- Departure time and arrival time in `HH:mm` format (bold)
- Duration in `Xh Ym` format
- Transfers badge: `p-tag` with `severity="secondary"`, value `{{ conn.transfers }} x` (grey)
- Train product chips: one `p-chip` per product (e.g. `IC`, `IR`, `RE`) with `styleClass="product-chip"`
- A `p-button` with `[outlined]="true"`, `severity="secondary"`, label `{{ 'trip.planner.select' | translate }}` on the right

The selected connection row gets a highlighted background class `connection-row--selected`.

While loading: show 3 `p-skeleton` rows (height 60px each, `borderRadius="8px"`, `styleClass="mb-2"`).

If no date/time is provided and ≥ 2 valid stops exist, draw straight-line route on the map immediately using `buildRailRoute()` without showing the connections panel.

---

### Section 3b — Attractions Along Route

Displayed after a route exists (road or rail). Section heading: `<i class="fa-light fa-map-pin"></i> {{ 'trip.planner.attractionsAlongRoute' | translate }}`.

For each stop, call `AttractionsService.searchAttractions()` with `geo.dist={lat},{lon},10000`, `language`, `hitsPerPage: 6`. Deduplicate by `identifier` across all stops.

While loading: show 4 `p-skeleton` rows (height 72px each, `borderRadius="8px"`, `styleClass="mb-2"`).

Each attraction row uses a horizontal card layout:
- Left: 56×56px photo thumbnail (CSS `object-fit: cover`, `border-radius: 8px`)
- Right: attraction name (bold, single line ellipsis) and a `p-tag` showing the first `classification.values[0].title` (if it exists) with `severity="secondary"`
- The entire row is clickable and opens the `attraction-detail` drawer with the attraction as payload.

On desktop: attractions can be displayed in a 1-column list (drawer is narrow). On mobile: same.

---

### Section 4 — Save Trip

Always visible at the bottom. Use `p-divider` above this section.

```html
<p-floatLabel>
    <input pInputText id="trip-name" [(ngModel)]="tripName" class="w-full" />
    <label for="trip-name">{{ 'trip.planner.tripName' | translate }}</label>
</p-floatLabel>
<span class="trip-name-suggestion">
    {{ 'trip.planner.tripNamePlaceholder' | translate }}: {{ suggestedName() }}
</span>
```

`suggestedName()` is a computed signal: `{firstStop} → {lastStop}`, or `{first} → {middle} → {last}` if a middle stop exists.

Below the name input:

```html
<p-button
    [label]="'trip.planner.save' | translate"
    icon="fa-light fa-floppy-disk"
    styleClass="w-full save-trip-btn"
    (onClick)="onSave()" />
```

- If user **is not logged in**: `onSave()` calls `drawerService.open('auth')`. Show a `p-message` below the button with `severity="info"` and text `{{ 'trip.planner.saveHint' | translate }}` (Sign in to save your trips).
- If user **is logged in**: `onSave()` calls `TripsService.saveTrip()`. On success, show a `p-toast` (position `bottom-center`) with `severity="success"` and summary `{{ 'trip.planner.savedSuccess' | translate }}`.

Add `<p-toast position="bottom-center" />` and `<p-confirmDialog />` at the root of the component template.

---

## Map Integration

### Update Map Component — `@frontend/src/app/shared/map/map.ts`

Add two new optional inputs:

```typescript
@Input() tripRoute: [number, number][] | null = null;
@Input() tripType: 'road' | 'rail' | null = null;
```

When `tripRoute` is set with ≥ 2 coordinate pairs, use `ngOnChanges` to add/update a MapLibre GeoJSON source named `'trip-route'` and a `line` layer:

- `line-color`: `#1a6b3c` (green, distinct from existing navy markers)
- `line-width`: 3
- `line-dasharray`: `[2, 1.5]` when `tripType === 'road'`, omit (solid line) when `tripType === 'rail'`
- `line-cap`: `'round'`
- `line-join`: `'round'`

Trip stop markers use color `#1a6b3c`, icon `fa-solid fa-location-dot`, and a sequential numeric label (`1`, `2`, `3`…) to indicate stop order. These are added alongside the regular attraction markers and do not replace them.

When `tripRoute` is `null` or empty, remove the `'trip-route'` source and layer if they exist, and remove any trip stop markers.

### Update DestinationsLayout — `@frontend/src/app/shell/destinations-layout/destinations-layout.ts`

- Inject `TripPlannerService`.
- Subscribe to `tripPlannerService.routeCoordinates$` and bind to `[tripRoute]` on the map component.
- Subscribe to `tripPlannerService.trip$` and bind `trip.type` to `[tripType]` on the map component.
- When the trip planner drawer closes, call `tripPlannerService.reset()`.

---

## Trigger Points

### Home Page — `@frontend/src/app/features/home/home.ts` and `home.html`

Wire up the hero CTA button to call `drawerService.open('trip-planner')`.

### Destination Detail — `@frontend/src/app/features/destinations/destination-detail/destination-detail.ts`

Wire up the `destinations.detail.planTrip` button to call `drawerService.open('trip-planner')` with the current destination pre-populated as the first stop. Convert `Destination.geo` to a `TripStop`: `{ stationId: destination.identifier, name: destination.name, lat: destination.geo.latitude, lon: destination.geo.longitude }`. In `TripPlannerComponent.ngOnInit()`, check for a payload from the drawer service and pre-fill the first stop if present.

---

## Profile Page — Saved Trips Section

### Update `@frontend/src/app/features/auth/profile/profile.ts` and `profile.html`

On `ngOnInit`, call `TripsService.getTrips()` and update the `stats.savedTrips` count with the real count.

Add a `Saved Trips` section below the profile details card and above the Sign Out button:

**Section heading:**
```html
<div class="saved-trips-header">
    <i class="fa-light fa-route"></i>
    <span>{{ 'profile.savedTrips' | translate }}</span>
</div>
```

**Empty state:** Show `{{ 'profile.savedTrips.empty' | translate }}` and a `p-button` with `[link]="true"` label `{{ 'trip.planner.planFirst' | translate }}` that calls `drawerService.open('trip-planner')`.

**Trip cards:** Render each `SavedTrip` as a card with:
- Trip name (bold heading)
- `p-tag` for trip type: `severity="success"` for Road, `severity="info"` for Rail, with icons `fa-light fa-car-side` / `fa-light fa-train`
- Stop summary line: `{stops[0].name} → {stops[last].name}` (grey subtext)
- Created date formatted as `DD MMM YYYY`
- A `p-button` `[outlined]="true"` label `{{ 'profile.savedTrips.view' | translate }}` that calls `drawerService.open('trip-planner')` with the saved trip as payload, then loads it into `TripPlannerService` state to render the route on the map
- A `p-button` `icon="fa-light fa-trash"` `[text]="true"` `severity="danger"` that uses `ConfirmationService` from PrimeNG to show a confirm dialog before calling `TripsService.deleteTrip()`

**Responsive grid:** On mobile (< 768px): cards are full-width in a single column. On desktop (≥ 768px): cards display in a 2-column grid using CSS Grid (`grid-template-columns: repeat(2, 1fr)`).

---

## Responsive Layout Rules

### Breakpoints

Use the same breakpoints as the rest of the app:
- Mobile: `< 768px`
- Desktop: `≥ 768px`

### Trip Planner Drawer Width

Follow the existing drawer pattern:
```
[style]="{ width: 'min(480px, calc(100vw - 20px))' }"
```
On mobile this fills nearly the full screen width. On desktop it sits as a comfortable side panel without covering the map entirely.

### Stop Builder

- On all screen sizes: stop rows are full-width with the sequence indicator on the left (fixed 32px) and the `p-autoComplete` filling the remaining width.
- Remove button is always visible on the right (24px).

### Connections Form

- Desktop: date input, time input, and `Find connections` button side-by-side in one row using CSS Flexbox (`flex-wrap: nowrap`, gaps of `0.5rem`). Date takes `flex: 2`, time takes `flex: 1`, button is fixed-width.
- Mobile: date input full-width, time input full-width, button full-width — all stacked vertically.

### Connections List

- On mobile: each connection row stacks the product chips below the time/duration row to prevent overflow.
- The connections list is scrollable with `max-height: 280px; overflow-y: auto` on both breakpoints.

### Attractions List

- Single column on all screen sizes (drawer is narrow by design).
- Each card has a fixed 56px thumbnail and flexible text area.

### Save Section

- All elements (name input, save button, hint message) are full-width on all screen sizes.

---

## Translation Keys

Add the following keys to all language files (`@frontend/src/assets/i18n/en.json`, `de.json`, `fr.json`, `it.json`):

```
trip.planner.title
trip.planner.typeRoad
trip.planner.typeRail
trip.planner.addStop
trip.planner.findConnections
trip.planner.date
trip.planner.time
trip.planner.connections
trip.planner.transfers
trip.planner.select
trip.planner.attractionsAlongRoute
trip.planner.tripName
trip.planner.tripNamePlaceholder
trip.planner.save
trip.planner.saveHint
trip.planner.savedSuccess
trip.planner.deleteConfirm
trip.planner.noTrips
trip.planner.planFirst
profile.savedTrips
profile.savedTrips.view
profile.savedTrips.empty
```

---

## Notes

- The backend transport proxy endpoints (`/api/v1/transport/locations` and `/api/v1/transport/connections`) are implemented separately and are a prerequisite for `TransportService`.
- OSRM routing calls are made directly from the frontend to `http://router.project-osrm.org` — no backend proxy needed.
- Rail route on the map uses straight lines between stop coordinates until a connection is selected.
- The `trip-planner` drawer does not collapse other drawers — it opens on top following the existing z-index stacking system.
- Attraction discovery per stop is triggered once the full stop list is confirmed, not on every keystroke.
- All `p-autoComplete` instances must use `[forceSelection]="true"` to ensure only valid transport network locations are stored as stops (never free-text strings).
- PrimeNG `ConfirmationService` must be provided at the component level for the delete confirmation dialog.

---

## References

- @context/project-overview.md
- @frontend/src/app/shared/services/drawer.ts
- @frontend/src/app/shared/drawer-host/drawer-host.ts
- @frontend/src/app/shared/map/map.ts
- @frontend/src/app/shared/services/attractions.ts
- @frontend/src/app/models/attraction.ts
- @frontend/src/app/models/destination.ts
- @frontend/src/app/features/destinations/destination-detail/destination-detail.ts
- @frontend/src/app/features/auth/profile/profile.ts
- @backend/src/models/User.js
- @backend/src/server.js
