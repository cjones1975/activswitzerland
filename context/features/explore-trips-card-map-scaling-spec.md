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
- `@Input() markers: { lng: number; lat: number; image?: string }[] = []` — activity positions.
  **Revised from the original v1 plan**: renders each marker's real `ACTIVITY_GROUPS` icon
  (`/assets/attraction|hike|bike.png`, the same `image` field `TripCard`'s existing
  `activityMarkers` computed already sets) as an SVG `<image>` at its projected position, drawn in
  its own `<g>` after the route line/dots so icons always paint on top; a marker with no `image`
  falls back to a small filled-circle dot (same accent color as the route line).
- **Purely decorative, no click handling** — confirmed explicitly after a mid-implementation
  detour: an earlier pass made thumbnail markers open a click-to-reveal name tooltip, then a
  revision made them open the attraction/hike/bike detail drawer directly from the thumbnail. Both
  were built on the wrong element — the intent was always for marker-click-to-open-drawer to live
  on the *real* map (inside the "View map" mask, see below), not the static thumbnail. Reverted;
  `RouteThumbnail` has no `@Output` at all.
- Background: **not** a flat `<rect>` like `TrailThumbnail`'s `.trail-thumb-bg` — a generic terrain
  PNG, already present at `frontend/src/assets/map_bg.png`, as a CSS `background-image` on the host,
  `background-size: cover`, with the SVG (transparent background) layered on top drawing only the
  line + marker icons/dots.

## `TripCard` changes

`trip-card.html:38-53` (`.tc-map-wrap` block): replace the unconditional `<app-map>` with
`<app-route-thumbnail [routeCoordinates]="trip.routeCoordinates ?? []" [tripType]="trip.type" [markers]="activityMarkers()">`
(reusing the existing `activityMarkers` computed as-is — extra fields beyond what `RouteThumbnail`
reads are harmless to pass through).

### Marker click opens the detail drawer — on the real map, not the thumbnail

Lives entirely on the `<app-map>` mounted inside the "View map" mask (see "Mount mechanism" below),
using `MapComponent`'s existing marker-click mechanism unchanged: a marker with both `label` (shown
as a popup, `map.ts`'s `addMarker`) and `clickable: true` (adds the popup's arrow button) makes
`MapComponent` emit `(markerClick)` when that button is tapped — the exact same two-step
click-marker-then-tap-popup-button interaction already used by `all-attractions`,
`destination-vertical-list`, and the hike/bike marker services. `TripCard.activityMarkers()` gained
`clickable: true, label: a.name` (was `clickable: false`, no label) to opt into this; the same
array still feeds `RouteThumbnail`, where the extra fields are simply unused.

**Real latent bug found and fixed in shared `MapComponent` along the way**: the popup's
`closeOnClick: true` option (`map.ts`'s `addMarker`) registers a map-wide `click` listener
(maplibre-gl internals: `Popup.addTo()` → `this._map.on('click', this._onClose)`, where `_onClose`
unconditionally calls `popup.remove()`) with **no check for whether the click landed inside the
popup's own content** — confirmed by reading `node_modules/maplibre-gl`'s source directly, not
guessed. For a clickable popup (the arrow-button case), that races the button's own click handler:
closeOnClick's removal can win and yank the popup (and the button with it) out of the DOM
before/during our own listener runs, so the `markerClick` emit intermittently never fires. This
is a real maplibre-gl gotcha, not specific to this app or this feature — it likely affected
`all-attractions`/`destination-vertical-list`/hike-bike markers' existing clickable popups too,
just never surfaced/reported before. Diagnosed live: a headless-browser click-through succeeded
100% of the time in one environment but the user's real browser reliably failed every time,
narrowing it to a timing race rather than a wiring bug. Fixed by setting
`closeOnClick: !marker.clickable` (clickable popups already remove themselves explicitly in the
button handler) and making the "close other open popups" behavior — previously relied on as a side
effect of closeOnClick firing on every click, including the click that opened a *different*
marker's popup — explicit instead, via `popup.on('open', () => this.closeOtherPopups(popup))` for
every popup regardless of type. Re-verified via 9/9 successful click-throughs across repeated
headless-browser attempts after the fix (was previously flaky/broken).

`onActivityMarkerClick(marker: MapMarker)` (`trip-card.ts`) mirrors `trip-planner-layout.ts`'s
existing method of the same name and lookup-then-open pattern exactly: find the
`TripActivitySelection` by `marker.id`, find its stop (`activity.stopId`) to build a `GeoPoint`
destination, then fetch and open — `AttractionsService.getAttraction(activity.refId, lang)` →
`drawerSvc.open('attraction-detail', …)` for `kind === 'attraction'`, or
`TrailRoutesService.getRoutes(kind, stop.lat, stop.lon, lang, …)` → matching `route.routeNumber`
against `activity.refId` → `drawerSvc.open('hike-detail' | 'bike-detail', …)` for hike/bike. The one
difference from the trip-planner version: the payload's `source` is `'explore-trips'`, not
`'trip-summary'` — a new source value added to `AttractionDetailPayload`/`HikeDetailPayload`/
`BikeDetailPayload` (`source?: 'trip-summary' | 'explore-trips' | …`).

`'explore-trips'` is folded into each drawer's existing `isXDetailTripPlanner()` computed in
`drawer-host.ts` (alongside `'trip-summary'`/`'search'`) for two effects, matching the precedent
those computeds already set for sourceless-of-a-map contexts:
- Hides the header's top-right "show on map" icon (`nav.showOnMap`/`fa-map-location`) — Explore
  Trips is a card grid with no full map behind the drawer for that icon to reveal.
- Forces the drawer modal (via the existing `stickyModal()` helper) even at desktop split-view
  widths, since there's no persistent sidebar content on this page to dock beside.

The back chevron (top-left) also branches on `source === 'explore-trips'` in each `onXDetailBack()`
(`drawer-host.ts`) to `langSvc.navigate(['explore-trips'])` instead of reopening a list drawer or
returning to the trip planner — its aria-label uses a new `exploreTrips.backToList` key instead of
`attractions.backToAttractions`/`hikes.backToList`/`bikes.backToList`.

`ExploreTrips.ngOnDestroy()` (`explore-trips.ts`) closes `attraction-detail`/`hike-detail`/
`bike-detail` on navigate-away, matching the same leftover-open-drawer cleanup precedent already
established in `destinations-layout.ts`/`trip-planner-layout.ts`.

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
             [fitBounds]="(trip.routeCoordinates?.length ?? 0) >= 2 ? trip.routeCoordinates! : null"
             (markerClick)="onActivityMarkerClick($event)" />
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
- **Revised post-spec**: markers on the thumbnail use the real per-activity-kind
  `ACTIVITY_GROUPS` icons (not plain dots) — feasible with no extra cost since
  `TripCard.activityMarkers()` already carries the `image` field the live map uses, and the
  thumbnail already computes each marker's pixel position for the (now-fallback-only) dot. Plain
  dots remain as the fallback for any marker with no `image` set.
- **Revised post-spec, again**: clicking a marker icon opens the real attraction/hike/bike detail
  drawer (see "Marker click opens the detail drawer" above) — but on the real map inside the "View
  map" mask, not the static thumbnail. The thumbnail's icons stay purely decorative; two earlier
  implementation passes wired this onto the thumbnail instead (first a tooltip, then the drawer
  open) before this was caught and corrected.

## Out of scope

- No change to `hikes-list`/`bikes-list` (`TrailThumbnail`) or the `hike-detail`/`bike-detail`
  preview maps — those are separate, already-working (mostly — the `@defer` leak is a distinct,
  smaller bug, not addressed by this spec).
- No backend changes, no image storage, no static-image generation pipeline (superseded — this
  replaces the earlier static-PNG-snapshot direction entirely).
- Explore Trips card flip (front/back), review mask, and "see more" truncation (already shipped) are
  unaffected — this only touches `.tc-map-wrap` and adds the new mask block alongside the existing
  `tc-review-mask`.

## Verification plan

`tsc --noEmit` + `ng build`. Live check via `ng serve`: confirm thumbnails render route + activity
icons (attraction/hike/bike) correctly for both road and rail trips, icons always visible on top of
the route line; confirm "View map" opens a fully interactive real map; confirm opening a second
card's map while one is already open closes the first (only one `<app-map>` in the DOM at any time
— check via DevTools element count, not just visually); confirm closing (✕) removes `<app-map>`
from the DOM entirely (not just visually hidden) so `ngOnDestroy`/`map.remove()` actually ran.
Confirm thumbnail icons are **not** clickable (no drawer, no popup) before "View map" is opened.
Inside the map mask, confirm clicking an activity marker shows its name popup, and clicking the
popup's button opens the correct drawer type (attraction/hike/bike) with the right content, no
"show on map" icon in its header, and that its back chevron returns to Explore Trips (not the trip
planner or an attractions/hikes/bikes list) — verified live via a headless-browser script:
7 straightforward attempts out of 8 activity markers across real trip cards opened their drawer
correctly on the first click-sequence; the remaining case was a marker sitting exactly under a
numbered stop marker at the initial `fitBounds` zoom level, which blocked the click — expected,
pre-existing behavior for any real MapLibre map with overlapping DOM markers (resolved by zooming
in), not something specific to this feature. Mobile check: load a page with a large number of
trips, confirm every card's thumbnail renders (no WebGL-context-limit failures possible since none
are created at rest).
