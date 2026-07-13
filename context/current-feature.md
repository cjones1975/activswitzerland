# Current Feature

## Feature

## Status

## Goals

## Notes

## History

<!-- Keep this updated. Earliest to latest -->

### 2026-06-15 — Trip Planner Wizard Specced

- Specced a step-based wizard for the Trip Planner drawer; see Goals above for full decisions
- Created `feature/trip-planner-wizard` branch (off `feature/trip-things-to-do`, which was
  committed as `bdc419e`) and `context/features/trip-planner-wizard-spec.md`

### 2026-06-16 — Trip Planner Wizard Implemented

- Wizard step model (`TripStep` type, `step` signal, `steps`/`currentStep` computed) added to `TripPlanner` component
- `canGoNext`/`nextHint` computed signals gate Back/Next navigation per step
- `goNext()`/`goBack()` navigation methods added
- `searchedConnections` signal tracks whether a connection search has been attempted (controls empty-state message)
- `onTypeChange()` resets step and `searchedConnections` on type toggle
- Error handler for `findConnections()` now also sets `searchedConnections` to true
- i18n keys added for all wizard steps across en/de/fr/it
- CSS updated for wizard layout and step-specific panels
- Template restructured into step-gated sections with Back/Next controls

### 2026-06-16 — Trip Planner Fixes Specced

- Created `context/features/trip-planner-fixes-spec.md` covering 11 UX/layout fixes for the wizard
- Key items: title layout, tripType button color, connections form overhaul (float label removal, time-only datepicker, remove Find Connections button), linear step enforcement, hide Back on step 1, full-height connections list, connection card time row

### 2026-06-16 — Trip Planner Fixes Implemented

- Branch: `feature/trip-planner-fixes`
- `drawer-host.html/css`: added `.tp-header-brand` (flex row) so icon + title sit on one row; overrode `.tp-drawer .p-drawer-content` to `overflow: hidden` so trip-planner owns its own scroll
- `trip-planner.css`: restructured to flex-column host layout; added `.tp-content` scrollable area; `.tp-section--fill` for full-height connections step; `#285278` selected button color; prominent `.stop-things-link` (border + bg); `.save-actions-row` for side-by-side save buttons; `flex-wrap: nowrap` on `.conn-times`
- `trip-planner.html`: `.tp-content` wrapper around `@switch`; Back button hidden on step 0 (spacer keeps grid); `p-floatLabel` replaced with plain labels on connections form; time input replaced with `p-datePicker [timeOnly]="true"`; Find Connections button removed; Next button shows `[loading]` while searching; connection step uses `.tp-section--fill`; save/view buttons wrapped in `.save-actions-row`
- `trip-planner.ts`: `connTime` signal changed to `signal<Date | null>(null)`; `canGoNext` for 'schedule' returns `!connectionsLoading()`; 'schedule' hint removed from `nextHint`; `goNext()` calls `findConnections()` when on schedule step; `findConnections()` extracts HH:MM from Date and auto-advances to connection step on success

### 2026-06-16 — Round Trip & Reordering Spec Added

- Round trip toggle implemented on the stops step: mirrors last stop to origin, keeps them in sync on origin change, locks end stop input and hides its remove button; resets on type change
- `swissNow()` helper added (uses `Intl.DateTimeFormat` with `Europe/Zurich`); `connDate`, `connTime`, and `today` now default to Swiss CET/CEST
- i18n key `trip.planner.roundTrip` added across en/de/fr/it
- Branch committed as `b475193`
- Created `context/features/trip-planner-reordering-spec.md` for next feature (Angular CDK drag-drop on via stops only; connections list explicitly out of scope)

### 2026-06-16 — Map View Fixes

- `trip-planner-layout.ts`: `tripBounds` now passes the full route polyline to `applyFitBounds` (instead of just first/last point) so round trips zoom to show the full route; added `tripStopPoints` computed signal mapping `trip().stops` → `[lon, lat][]`
- `trip-planner-layout.html`: passes `[tripStopPoints]` to `app-map`
- `map.ts`: added `@Input() tripStopPoints`; road trip markers now use `fa-circle-dot` (green) for origin, `fa-location-dot` (red) for destination, and navy numbered circles for via stops

### 2026-06-17 — Stop Reordering Completed

- Feature reviewed and accepted; branch `feature/trip-planner-reordering` marked complete

### 2026-06-17 — Transport Connection Detail Specced

- Specced redesigned connection cards for the rail trip planner connection step
- Created `feature/transport-connection-detail` branch and `context/features/transport-connection-detail-spec.md`
- Key decisions: section data mapped from existing `/connections` API (no backend changes); `TripConnection.sections` is optional for backwards compatibility; card click = select, chevron click = expand/collapse detail; walk sections shown as connectors between journey legs

### 2026-06-17 — Transport Connection Detail Implemented

- `models/trip.ts`: added `TripSectionStop`, `TripSectionJourney`, `TripSection` interfaces; `TripConnection` extended with optional `sections?: TripSection[]`
- `transport.ts`: added `SectionStop`, `SectionJourney`, `SectionWalk`, `ConnectionSection` interfaces; replaced broad `sections` type on `ConnectionResult`; added `mapSections()` private method; `getConnections` mapping now includes `sections`; `extractPassListCoords` parameter updated to `ConnectionSection[]`
- `trip-planner.ts`: removed `Tag`/`Chip` imports (no longer used); added `expandedConnectionIndex` signal; `onTypeChange` and `findConnections` both reset it; added `toggleDetail()`, `formatPlatform()`, `trainColor()`, `categoryLabel()` methods
- `trip-planner.html`: connection step `@for` block fully replaced — new `.conn-card` (clickable, selectable), header row (route + chevron), meta row (transfers + duration), timeline bar, expandable `.conn-detail` with per-section journey stops/train/walk rendering
- `trip-planner.css`: old `.conn-row`/`.conn-main`/`.conn-times`/tags styles replaced with new card, header, meta, timeline, stop, leg, walk, and platform-badge rules
- `en/de/fr/it.json`: added `trip.planner.transfer` (singular) and `trip.planner.connection.direction`/`connection.walk` keys in all four locales

### 2026-06-18 — Transport Connection Detail Fixes

- Walk duration: API returns seconds; `formatWalk()` converts to minutes (`Math.floor(s/60)`), returns `''` for null/undefined/under 60s; template renders "Walk" alone or "Walk · X min" with duration appended — `{{duration}} min` parameter removed from all four i18n `walk` keys
- Timeline times: `firstTrainDeparture()` and `lastTrainArrival()` helpers find the first/last journey section's times, skipping any leading/trailing walk sections that were inflating the displayed range
- Train label: changed from `section.journey.name` (API combined field) to `section.journey.category + section.journey.number` so the display is built from discrete fields as intended

### 2026-06-18 — Transport Connection Detail Completed

- Feature reviewed and accepted; branch `feature/transport-connection-detail` marked complete


### 2026-06-19 — Map Marker Anchor Fix

- All MapLibre custom markers now wrap the Font Awesome `<i>` icon in a 28×28px `.map-marker-container` flex div; MapLibre measures the container for its `anchor: 'center'` calculation, giving precise coordinate alignment at all zoom levels
- Without the wrapper, MapLibre measured the `<i>` element's unreliable inline font-metric bounding box, producing a fixed CSS-pixel offset that appeared as large geographic drift at low zoom and shrank on zoom-in

### 2026-06-19 — Misc Fixes 2 Implemented

- Branch: `feature/misc-fixes-2`
- `trip-planner.ts` (service): added `DRAFT_KEY` constant; constructor restores draft from `localStorage` on app load; `_trip$` subscription with `debounceTime(300)` + `skip(1)` auto-saves stops/type/name/routeCoordinates; added `clearDraft()` method; removed `catchError` from `buildRoadRoute()` so errors propagate
- `trip-planner.ts` (component): added `routeError` signal; `onStopsChanged()` now catches route errors and sets `routeError`; calls `plannerSvc.clearDraft()` on type change and on successful save; added `moveStopUp()`/`moveStopDown()` methods; added `getStopSelections()`/`getAttractionName()` helpers for finish summary; imported `Panel`
- `trip-planner.html`: route error `p-message` below stop list skeleton; keyboard move-up/down buttons on via-stop rows (`.stop-kbd-btns`); `aria-label` on each `p-autoComplete` (From/To/Via N), remove button, and drag handle; finish step trip summary (`trip-summary` block with `stop-indicator` + `p-panel` per stop with attractions)
- `trip-planner.css`: `.stop-kbd-btns` hidden by default, shown on `.stop-row:focus-within`; `.stop-kbd-btn` styles; full finish-step summary styles (`.trip-summary`, `.summary-stop-row`, `.summary-panel`, `.summary-attraction-row`)
- `attraction-vertical-list.ts/html`: added `loadError` signal; `catchError` in pipe returns null sentinel; template shows `p-message severity="warn"` instead of skeleton on error
- `all-attractions.ts/html`: added `loadError` signal; `loadMore()` error handler sets it; template shows `p-message` in the non-search list branch
- `things-to-do.ts/html`: added `loadError` signal; `catchError` on `fetchTrigger$` inner observable; reset clears error; template shows `p-message` between skeleton and empty states
- `attraction-detail.ts/html`: added `loadError` signal; `catchError` in `fetchTrigger$` pipeline; error resets on payload clear; template shows `p-message` above the gallery skeleton
- `map.ts`: replaced `markerInstances: Marker[]` with `Map<string, { marker, el }>`; added `markerKey()`/`buildMarkerEl()`/`addMarker()` helpers; `syncMarkers()` now diffs by key — removes stale, updates `className`/`color` in-place, adds only new; `ngOnDestroy` iterates the Map
- `footer-nav.ts`: injected `Router`; `showNav` signal via `toSignal` on `NavigationEnd` events — true only for `/destinations/:id` and `/trip-planner[/:id]`; host binding `[style.display]` hides nav on all other routes
- `drawer-host.html`: `[attr.aria-label]` added to all `menu-close` buttons (close or show-on-map) using `nav.close` / `nav.showOnMap` keys
- `en/de/fr/it.json`: added `trip.planner.routeError`, `removeStop`, `dragStop`, `moveStopUp`, `moveStopDown`, `attraction`, `attractions`; added `attractions.loadError` and `attractions.detail.loadError`; added new `nav.close` / `nav.showOnMap` section

### 2026-06-19 — Misc Fixes 1 Implemented

- Branch: `feature/misc-fixes-1`
- `trip-planner.html`: wrapped Round Trip button in `@if (selectedType() !== 'rail')` to hide it for rail trips; replaced `.stop-input-row` + `.stop-actions` structure with `p-inputGroup` containing two `p-inputGroupAddon` slots (remove × and drag ⠿ icons inline in the input); moved `[class.stop-action--hidden]` to the inner icon/button so addon borders always render and every row looks the same width
- `trip-planner.ts`: imported `InputGroup` and `InputGroupAddon` from PrimeNG
- `trip-planner.css`: replaced old `.stop-input-row`/`.stop-actions`/`.stop-remove` rules with `.stop-input-group`, `.stop-addon`, `.stop-icon-btn`, and drag-addon styles; suppressed focus/hover border-color and box-shadow on autocomplete input inside the group
- `trip-planner-layout.ts`: added `displayedTripRoute` and `displayedTripStopPoints` computed signals that return `null`/`[]` while the trip-planner drawer is open, deferring route display on the map until Save/View Trip collapses the drawer; added `clickable: true` to `tripAttractionMarkers`; injected `AttractionMarkersService`; added `onAttractionMarkerClick()` to open `attraction-detail` drawer with `source: 'trip-planner'`; default `center` set to Switzerland `[8.2275, 46.8182]`; added `mapZoom` signal (default 7, set to 12 on destination load, 10 on stored route center)
- `trip-planner-layout.html`: switched `[tripRoute]`/`[tripStopPoints]` to `displayedTripRoute()`/`displayedTripStopPoints()`; wired `(markerClick)="onAttractionMarkerClick($event)"`; changed `[zoom]` to `[mapZoom()]`
- `attraction-detail.ts`: added `'trip-planner'` to `AttractionDetailPayload.source` union type
- `drawer-host.html`: added `@else if (attractionDetailSource() === 'trip-planner')` branch for the attraction-detail back button label
- `drawer-host.ts`: `onAttractionDetailBack()` now handles `source === 'trip-planner'` — closes attraction-detail and reopens trip-planner
- `map.css`: removed `max-width` on popup to fix tooltip truncation; moved `maplibregl-ctrl-bottom-right` bottom offset from mobile-only media query to unconditional (footer-nav is now visible at all widths)
- `footer-nav.css`: changed desktop media query (`≥600px`) to hide `.footer-btn` only, leaving the nav bar itself visible
- `header-nav.css`: added `border-bottom: none; box-shadow: none` to p-menubar to eliminate white visual gap below the header
- `trip-planner-layout.css` / `destinations-layout.css`: added `background: var(--navy-800)` to host as defensive fallback against any gap between header and map
- `en/de/fr/it.json`: added `trip.planner.backToPlanner` key in all four locales

### 2026-06-16 — Stop Reordering Implemented

- Branch: `feature/trip-planner-reordering`
- `@angular/cdk@21` installed
- `trip-planner.ts`: imported `DragDropModule`, `CdkDragDrop`, `moveItemInArray`; added `reorderStop(event)` handler — clamps drop index to via-stop range (1..n-2), moves both `stops` and `stopSuggestions` in sync, then calls `onStopsChanged()`
- `trip-planner.html`: `cdkDropList` + `(cdkDropListDropped)` on `.stop-list`; `cdkDrag` + `[cdkDragDisabled]` (disabled for origin, destination, and while loading) on each row; `cdkDragHandle` grip icon shown only for via stops; `*cdkDragPreview` shows stop name with grip icon; `*cdkDragPlaceholder` renders dashed empty slot
- `trip-planner.css`: `.stop-drag-handle` (grab cursor, right-aligned); `.stop-drag-preview` (white card + box-shadow); `.stop-drag-placeholder` (dashed border); CDK animation transitions

### 2026-07-03 — Home Categories Specced

- Specced two new home page destination sections (Mountains, Lakes & Glaciers; Nature Parks) alongside the existing City Breaks section, all sharing `DestinationHorizontalList`
- New `destination-category.ts` model (`CategoryKey`/`CategoryConfig`/`DESTINATION_CATEGORIES`) to centralize per-category facets, copy keys, and map icon; `DestinationVerticalList` to become dynamic via `?category=` query param instead of static `@Input()`s
- Created `context/features/home-categories-spec.md`; no feature branch created yet

### 2026-07-08 — Home Categories Implemented

- `models/destination-category.ts`: new model with `CategoryKey` type, `CategoryConfig` interface, and `DESTINATION_CATEGORIES` record (`cities`/`mountains-lakes`/`nature-parks`) centralizing facets, title/subtitle/pageSubtitle copy keys, card title, and map icon per category
- `home.html`/`home.css`: replaced `.destinations-section` with banded `.home-section`/`.section-inner` layout; three `DestinationHorizontalList` sections (City Breaks, Mountains/Lakes/Glaciers, Nature Parks) with alternating white/`#f5f6f7` backgrounds and `viewAllQueryParams` carrying `?category=`
- `destination-horizontal-list.ts/html`: added `viewAllQueryParams` input, bound alongside `routerLink` on the "View all" link
- `destination-vertical-list.ts/html`: now reads `?category=` via `ActivatedRoute`, resolves `CategoryConfig` from `DESTINATION_CATEGORIES` (defaults to `cities`), holds it in a signal, re-fetches on category/language change, and drives title/subtitle/card badge/map icon from the config; removed the now-unused static `@Input()`s
- `en/de/fr/it.json`: added `destinations.mountains` and `destinations.natureParks` keys (title/subtitle/count) in all four locales

### 2026-07-08 — Destination Detail Fixes 2 Specced

- Specced 5 fixes to `destination-detail`/map/drawer/trip-planner chrome, prompted by the new home-page categories: (1) hide attraction UI when a destination has 0 attractions; (2) destination-detail map shows only a red/bigger destination pin, attraction pins gated to the all-attractions context; (3) Plan Trip/weather boxes side by side via a two-column `.action-grid`; (4) dynamic "back to destinations" via a `?category=` query param carried through destination links; (5) road-trip prefill seeded from the destination's own `dest.geo` instead of an address search (fixes mountain/lake/glacier destinations with no street address) — rail nearest-station lookup deferred
- Created `context/features/dest-detail-fixes2-spec.md`; no feature branch created yet

### 2026-07-10 — Destination Detail Fixes 2 Implemented

- Branch: `feature/dest-detail-fixes-2`
- `attraction-markers.ts`: added `hasAttractions` signal (default `true`) + `setHasAttractions()`, reset in `clear()`
- `attraction-vertical-list.ts/html`: reports `hasAttractions` after load; stopped seeding map markers from the top-attractions list; `onAttractionClick` now opens `attraction-detail` directly with `source: 'destination-detail'`; whole section hidden once loaded with zero attractions
- `destinations-layout.ts/html`: added `destinationMarker` (red, `.destination-marker` class, always shown) and `showAttractionMarkers`/`displayMarkers` gating so attraction pins only render while on the all-attractions list (open, collapsed, or an attraction-detail reached from it); reopen buttons gated on `attractionMarkers.hasAttractions()`
- `drawer-host.ts/html`: `onAttractionDetailBack()` handles `source: 'destination-detail'`; `onDestinationBack()` reads `category` off the current URL (`Router.parseUrl`) and forwards it instead of always defaulting to `/destinations`
- `map.css`: `.destination-marker` (2.2rem, red)
- `destination-detail.css`: `.action-grid` → two columns (Plan Trip / Weather side by side, equal height via CSS Grid stretch), single column under 400px
- `destination-horizontal-list.ts/html`, `destination-vertical-list.ts/html`, `home.html`: new `categoryKey` input carries `?category=` on every destination-card link
- `trip-planner-layout.ts`: road-trip prefill payload changed from a bare name string to `{ name, lat, lon, identifier }` when geo is known
- `trip-planner.ts`: prefill effect seeds the 'to' stop directly from destination coordinates for road trips (bypassing address search); `TripPlannerService.buildRoadRoute()` throws `NO_ROAD_ROUTE` when OSRM returns non-`Ok`, surfaced via new `routeUnreachable` signal that blocks `canGoNext`/shows a dedicated error message; pre-filled 'to' stop is locked (`destinationLocked`) — disabled input, hidden remove button
- i18n: `trip.planner.routeUnreachable` added across en/de/fr/it
- Follow-up fixes in the same branch: removed the round-trip feature entirely (`isRoundTrip`, `toggleRoundTrip()`, button, CSS, `roundTrip` i18n key); fixed a long-standing typo where PrimeNG's addon class is `p-inputgroupaddon` (no hyphen) not `p-inputgroup-addon` — every addon override rule (background, hover, drag cursor, and the new `.stop-addon--disabled` gray-out) was silently dead until corrected; `trip-planner-layout.ts/html` gained `displayedTripAttractionMarkers`, hiding "things to do" pins until the drawer collapses (Save/View Trip), mirroring the existing route/stop-marker gating; `map.ts/css` — attraction marker containers now carry their `className` via safe `classList` diffing (preserves MapLibre's own marker class) and get `z-index: 5` so they stay clickable over overlapping destination/route markers; road route line is now solid `#1a2f4a` (was dashed green), rail unchanged; `trip-planner.ts` prefill effect now detects a genuinely new destination (vs. resuming a restored draft for the same one) and calls `resetForNewDestination()` — wipes route/stops/attraction cache via `plannerSvc.reset()`, resets wizard step to 0, clears connections/trip name
- Feature marked complete
