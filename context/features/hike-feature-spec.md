# Hiking Routes Feature

## Overview

Add hiking routes sourced from geo.admin.ch's `ch.astra.wanderland` (SchweizMobil Wanderland) layer. Given a coordinate and radius, the backend returns nearby hiking routes with name, category (national/regional/local), and geometry. The frontend displays these as cards with a trail-shape SVG thumbnail color-coded by category, and lets the user open a route on a MapLibre map or download it as a GPX file.

## Backend

### Existing endpoint

- `GET /api/v1/hikes?lat=&lon=&radius=` — implemented in @backend/src/controllers/hikingRoutes.js, @backend/src/routes/hikingRoutes.js, @backend/src/middleware/lv95Converter.js
- `convertToLV95` middleware converts `lat`/`lon` (WGS84) to LV95 easting/northing (`req.lv95`), returns 400 if non-numeric
- Controller calls geo.admin.ch's `identify` service (`all:ch.astra.wanderland`, `tolerance` = radius in meters, `sr=2056`, `geometryFormat=geojson`) and returns `{ success, count, radiusMeters, data }`, where each item has `id`, `name`, `properties`, `geometry` (LineString, LV95 meters)
- `properties` returned by geo.admin.ch for this layer: `chmobil_title`, `chmobil_route_number`, `chmobil_has_segment`, `label` — no description, image, or explicit category field is available from this layer or from the MySwitzerland API (confirmed MySwitzerland has no hiking content type)

### Requirements to add

- **Distance calculation**: sum Euclidean distance between consecutive LineString vertices (already in LV95 meters, so no reprojection needed) to compute trail length. Add `distanceKm` (and/or `distanceMiles` = km × 0.621371) to each hike in the `getHikes` response.
- **Route category**: derive `category: 'national' | 'regional' | 'local'` from `chmobil_route_number` using SchweizMobil's numbering convention — 1–9 national, 10–99 regional, 100+ local. This is inferred from SchweizMobil's public numbering scheme, not an explicit API field — spot-check against a known national route before relying on it in the UI.
- **GPX export**: new endpoint (e.g. `GET/POST /api/v1/hikes/gpx`) that accepts the route's geometry (already available on the client from the `/hikes` response — no need to re-query geo.admin.ch by feature id), inverse-projects each `[easting, northing]` back to WGS84 via `proj4('EPSG:2056', 'EPSG:4326', ...)`, and returns a GPX XML document (`<trk><trkseg><trkpt lat lon/>`) with `Content-Type: application/gpx+xml` and `Content-Disposition: attachment; filename="<route-name>.gpx"`.

## Frontend

### Hike card list

- Cards display: route name (`chmobil_title`), category badge (national/regional/local), distance (km/miles)
- No photo is available for individual routes (neither geo.admin.ch nor MySwitzerland provide one) — use a generated trail-shape thumbnail instead of a photo
- **Trail-shape thumbnail**: normalize the route's LineString geometry to fit a small SVG viewbox and render it as a simple polyline (no basemap/tiles) — cheap to render for lists of 50–100 cards, unlike embedding a live MapLibre (WebGL) instance per card, which would exceed browser concurrent-WebGL-context limits
- **Category color coding**: mirror SchweizMobil's real-world trail signage convention — red for national routes, blue for regional, yellow for local. Apply this color to the SVG polyline (and/or a light background wash) so the thumbnail also communicates category at a glance

### Map view

- Reuse the existing shared map component (@frontend/src/app/shared/map, MapLibre) to display the selected route's full geometry when the user opens a hike from the list
- Reproject the route geometry from LV95 to WGS84 for MapLibre (which expects lon/lat) — same inverse-projection approach as the GPX export

### GPX download

- Add a download action on the hike detail/map view that calls the backend GPX endpoint and triggers a file download in the browser

## Notes

- `chmobil_has_segment` property meaning is not fully confirmed — likely indicates whether the route is broken into sub-segments/stages in SchweizMobil's system, but no test case with `true` has been observed yet to verify
- Static map thumbnails from geo.admin.ch (WMS/print service) were considered but not pursued — the exact request schema wasn't confirmed, and the SVG trail-shape approach avoids the dependency entirely while scaling better for large card lists
- `HIKING_LAYER` constant in the controller can be swapped to `ch.astra.veloland` / `ch.astra.mountainbikeland` to reuse this same pattern for cycling/MTB routes in future

## References

- @backend/src/controllers/hikingRoutes.js
- @backend/src/routes/hikingRoutes.js
- @backend/src/middleware/lv95Converter.js
- @context/project-overview.md
