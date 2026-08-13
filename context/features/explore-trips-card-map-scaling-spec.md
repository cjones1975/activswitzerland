# Explore Trips Cards: Static Route Thumbnail + On-Demand Map Mask

## Goal

Every Explore Trips card currently mounts a live MapLibre GL map unconditionally
(`trip-card.html:38-45`, `<app-map [tripRoute]="trip.routeCoordinates ?? []" ...>`). Each one is its
own real WebGL context. This doesn't scale: diagnosed live, on a 10-trip test the last 1-2 cards
failed to render their map on mobile because mobile browsers cap simultaneous WebGL contexts far
lower than desktop, and `MapComponent`/`maplibre-gl` has no handling for context-creation failure
(no try/catch around `new maplibregl.Map(...)`, no `map.on('error', ...)`). With a target of
thousands of trips, "one live map per visible card" has no ceiling that works.

Replace the always-on live map with:
- A **static, dependency-free client-side route thumbnail** (SVG route line + activity markers over
  a generic terrain background image) shown by default on every card — zero WebGL contexts at rest,
  regardless of trip count.
- A **"View map" link** (bottom-right of the thumbnail) that opens a mask covering the card with the
  real, fully-interactive `MapComponent` (zoom/pan, real tiles) — mounted only while open.
- **Exactly one map mask open at a time, app-wide** — opening a new one closes any other. The mask's
  `<app-map>` is destroyed (not just hidden) the moment it closes, so at most one live WebGL context
  exists at any point in time, regardless of how many cards/trips exist.

This mirrors the fix already applied to `hikes-list`/`bikes-list` cards, which use a flat SVG
`TrailThumbnail` (`shared/trail-thumbnail/`) instead of a live map, reusing the same
bounding-box-projection technique. It is *not* the same mechanism as the `hike-detail`/`bike-detail`
drawers' small embedded map (`hike-bike-detail-map-spec.md`) — those are real MapLibre maps, deliberately
non-interactive, and (per a separate diagnosis) currently leak their WebGL context because they're
mounted via `@defer (when svc.isOpen(...))`, which never un-defers when the drawer closes. **This spec's
mask must not repeat that mistake** — see "Mount mechanism" below.

## No backend changes required

`getPublicTrips` (`backend/src/controllers/trips.js:121-169`) already returns full trip documents,
including `routeCoordinates`, `stops`, and `activities` (with `lat`/`lon`) — the same fields
`TripCard`'s existing `activityMarkers`/`stopPoints` computed signals already consume for the live
map (`trip-card.ts:56-69`). The thumbnail is computed entirely from data already on the client; no
new API field, no server-side rendering, no storage.

## New component: `RouteThumbnail` (`shared/route-thumbnail/`)

Sibling to `shared/trail-thumbnail/`, same bounding-box → SVG-viewBox projection math
(`trail-thumbnail.ts:29-58`: find min/max of all coordinates, scale to fit a padded viewBox,
flip Y since northing increases upward but SVG y increases downward), extended for this use case:

- `@Input() routeCoordinates: [number, number][] = []` — drives the route polyline, same shape as
  `MapComponent`'s `[tripRoute]`.
- `@Input() tripType: 'road' | 'rail' = 'road'` — line color, matching `MapComponent`'s existing
  road/rail convention exactly (`map.ts:334`): `#1a2f4a` (navy) for road, `#1a6b3c` (green) for rail.
- `@Input() markers: { lng: number; lat: number }[] = []` — activity positions, drawn as small
  filled-circle dots at their projected position (same accent color as the route line). Full
  per-activity-kind icon parity with the live map's `ACTIVITY_GROUPS` icon set is **out of scope**
  for v1 (see below) — plain dots only.
- Background: **not** a flat `<rect>` like `TrailThumbnail`'s `.trail-thumb-bg` — a generic terrain
  PNG, already present at `frontend/src/assets/map_bg.png`, as a CSS `background-image` on the host,
  `background-size: cover`, with the SVG (transparent background) layered on top drawing only the
  line + marker dots.

## `TripCard` changes

`trip-card.html:38-53` (`.tc-map-wrap` block): replace the unconditional `<app-map>` with
`<app-route-thumbnail [routeCoordinates]="trip.routeCoordinates ?? []" [tripType]="trip.type" [markers]="activityMarkers()">`
(reusing the existing `activityMarkers` computed, just needs `{lng,lat}` — already its shape minus
the map-specific `id`/`clickable`/`image` fields, no change needed there since extra fields are
harmless to pass through).

Add a "View map" link, bottom-right corner of `.tc-map-wrap`:
```html
<button class="tc-view-map" type="button" (click)="mapMaskSvc.open(trip._id!); $event.stopPropagation()">
  <i class="fa-regular fa-expand"></i>
  {{ 'exploreTrips.viewMap' | translate }}
</button>
```
`.tc-view-map`: `position: absolute; bottom: 0.5rem; right: 0.5rem;` within `.tc-map-wrap` (already
`position: relative`, `trip-card.css:79-87`).

## New service: `ExploreMapMask` (`shared/services/explore-map-mask.ts`)

Cross-card coordination needs shared state — `TripCard` instances are siblings with no other channel
between them, same reason the existing `Drawer` service (`shared/services/drawer.ts`) exists for
drawer coordination. This is simpler than `Drawer`: a single current-trip-id value, not a
z-index stack, since only one can ever be open.

```ts
@Injectable({ providedIn: 'root' })
export class ExploreMapMask {
  private openTripId = signal<string | null>(null);

  isOpen(tripId: string): boolean { return this.openTripId() === tripId; }
  open(tripId: string): void { this.openTripId.set(tripId); }  // overwrite = closes any other
  close(): void { this.openTripId.set(null); }
}
```

## Mount mechanism — plain conditional, not `@defer`

`trip-card.html`, inside `.tc-front` (same pattern as the existing `tc-review-mask`, `position:
absolute; inset: 0` against `.tc-face`'s positioning context):

```html
@if (mapMaskSvc.isOpen(trip._id!)) {
  <div class="tc-map-mask" (click)="$event.stopPropagation()">
    <button class="tc-map-mask-close" type="button" (click)="mapMaskSvc.close()" [attr.aria-label]="'nav.close' | translate">
      <i class="fa-light fa-xmark"></i>
    </button>
    <app-map [tripRoute]="trip.routeCoordinates ?? []" [tripType]="trip.type"
             [tripStopPoints]="stopPoints()" [markers]="activityMarkers()"
             [fitBounds]="(trip.routeCoordinates?.length ?? 0) >= 2 ? trip.routeCoordinates! : null" />
  </div>
}
```

**Must be a plain `@if`, never `@defer (when ...)`.** A bare `@defer` block resolves once and never
reverts to its placeholder when the trigger condition later goes false — confirmed as the exact cause
of the `hike-detail`/`bike-detail` map leak (`drawer-host.html:287-291`, no wrapping `@if`). `@if`
correctly triggers Angular's normal mount/unmount lifecycle, so `MapComponent.ngOnDestroy()` (already
implemented correctly, `map.ts:476-481`: `this.map?.remove()`) runs and the WebGL context is freed the
moment `mapMaskSvc.close()` fires or another card's mask opens (since `ExploreMapMask.open()`
overwrites the single `openTripId`, this card's `@if` becomes false on the next change-detection pass
same as an explicit close).

`<app-map>` here keeps default `interactive: true` (no `[interactive]="false"`, unlike the hike/bike
detail preview) — the whole point is real zoom/pan.

## Confirmed decisions

- Exactly one map mask open at a time, app-wide, enforced via `ExploreMapMask`'s single-value signal
  — not per-card local state.
- Thumbnail background is a generic terrain PNG (not a flat color/gradient) —
  `frontend/src/assets/map_bg.png`, already in the repo.
- "View map" trigger: `fa-regular fa-expand` icon + "View map" text, bottom-right corner of the
  thumbnail area.
- Markers on the thumbnail are plain dots, not full activity-kind icons — matches `TrailThumbnail`'s
  existing level of simplification for the same problem elsewhere in the app.

## Out of scope

- No change to `hikes-list`/`bikes-list` (`TrailThumbnail`) or the `hike-detail`/`bike-detail`
  preview maps — those are separate, already-working (mostly — the `@defer` leak is a distinct,
  smaller bug, not addressed by this spec).
- No per-activity-kind icon set on the thumbnail (dots only, v1).
- No backend changes, no image storage, no static-image generation pipeline (superseded — this
  replaces the earlier static-PNG-snapshot direction entirely).
- Explore Trips card flip (front/back), review mask, and "see more" truncation (already shipped) are
  unaffected — this only touches `.tc-map-wrap` and adds the new mask block alongside the existing
  `tc-review-mask`.

## Verification plan

`tsc --noEmit` + `ng build`. Live check via `ng serve`: confirm thumbnails render route + marker dots
correctly for both road and rail trips; confirm "View map" opens a fully interactive real map;
confirm opening a second card's map while one is already open closes the first (only one `<app-map>`
in the DOM at any time — check via DevTools element count, not just visually); confirm closing (✕)
removes `<app-map>` from the DOM entirely (not just visually hidden) so `ngOnDestroy`/`map.remove()`
actually ran. Mobile check: load a page with a large number of trips, confirm every card's thumbnail
renders (no WebGL-context-limit failures possible since none are created at rest).
