# Hike/Bike Detail: Real Map Instead of Gray Thumbnail

## Goal

`hike-detail`/`bike-detail` drawers currently show the route as a flat SVG polyline
(`app-trail-thumbnail`) drawn over a plain gray rectangle (`.trail-thumb-bg`, `--gray-100`).
Replace that box with a real small MapLibre map showing the actual route line over real map
tiles, reusing the existing shared `MapComponent` (`shared/map/map.ts`) rather than building a
new map integration.

## Scope

Both `features/hikes/hike-detail/` and `features/bikes/bike-detail/` (identical structure,
mirrored change in both):

- `hike-detail.ts`/`bike-detail.ts`: drop the `TrailThumbnail` import/usage; add two computed
  signals derived from `payload()`:
  - `trailLines: [number, number][][]` — `p.route.stages.flatMap(s => s.geometryWgs84?.coordinates ?? [])`,
    mirroring `destinations-layout.ts`'s existing `collectLines()`/`trailRoute` computed (same
    shape `MapComponent`'s `[trailRoute]` input already expects).
  - `trailColor: string` — `trailCategoryColor(p.route.category)` from `models/trail-route.ts`
    (same helper `destinations-layout.ts` already uses for the background map's route line).
  - `fitBoundsCoords: [number, number][]` — `trailLines().flat()`, fed to `MapComponent`'s
    `[fitBounds]` input so the small map frames the whole route on load with no manual
    center/zoom guessing.
- `hike-detail.html`/`bike-detail.html`: inside `.trail-detail-thumb-wrap`, replace
  `<app-trail-thumbnail [stages]="p.route.stages" [category]="p.route.category" />` with
  `<app-map [trailRoute]="trailLines()" [trailColor]="trailColor()" [fitBounds]="fitBoundsCoords()" [interactive]="false" />`.
  No markers needed — the route line is the only content.
- `hike-detail.css`/`bike-detail.css`: `.trail-detail-thumb-wrap` needs `position: relative`
  added — `MapComponent`'s `:host` is `position: absolute; inset: 0`, which requires a
  positioned ancestor to fill (same reason `destinations-layout.css`'s host is
  `position: absolute; inset: 0` against its own routed-view ancestor). Existing
  `width: 100%; height: 160px; border-radius: 10px; overflow: hidden` stay as-is.
- `shared/trail-thumbnail/` stays untouched — still used by `hikes-list`/`bikes-list` cards.

## New `MapComponent` input: `interactive`

`shared/map/map.ts` gains `@Input() interactive = true`. When `false`:
- Skip adding `NavigationControl` (a zoom/compass widget is pointless clutter on a ~160px-tall
  preview box).
- Disable `scrollZoom`, `dragPan`, `dragRotate`, `doubleClickZoom`, `touchZoomRotate` on the
  MapLibre instance right after construction.

**Why:** every existing `app-map` usage is a full-page background map where capturing
scroll/drag for pan-zoom is exactly right. Embedding a map inside `.trail-detail-thumb-wrap`
puts it inside the drawer's own scrollable content — an interactive map there would hijack mouse
wheel scroll and touch drag the moment the cursor/finger crosses its bounds, fighting the
drawer's normal scroll. `interactive: false` keeps the route visually real (real tiles, real
route line, still visible/legible) without trapping scroll. All three other `app-map` call sites
(`destinations-layout`, `trip-planner-layout`) are unaffected — they don't pass `[interactive]`,
so they keep today's default (`true`) behavior unchanged.

## Out of scope

- No change to `hikes-list`/`bikes-list` card thumbnails (still the SVG `TrailThumbnail`).
- No markers/pins on the small map (trailhead marker, destination pin, etc.) — just the route
  line, matching what was asked.
- No change to the full-page background map's existing `trailRoute`/`trailColor` behavior in
  `destinations-layout.ts` (already shows the selected route today, unrelated to this drawer-
  internal thumbnail).

## Verification plan

`tsc --noEmit` + `ng build`; live check via `ng serve`: open a hike and a bike detail drawer from
both the destinations map-marker click path and the hikes/bikes list, confirm the route renders
on real tiles, confirm scrolling the drawer content over the map doesn't zoom/pan it, confirm the
existing full-page background map (still showing the same route) is unaffected.
