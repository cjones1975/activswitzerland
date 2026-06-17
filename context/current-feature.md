# Current Feature

## Feature

## Status

Completed. Branch: `feature/trip-planner-reordering`.

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

### 2026-06-16 — Stop Reordering Implemented

- Branch: `feature/trip-planner-reordering`
- `@angular/cdk@21` installed
- `trip-planner.ts`: imported `DragDropModule`, `CdkDragDrop`, `moveItemInArray`; added `reorderStop(event)` handler — clamps drop index to via-stop range (1..n-2), moves both `stops` and `stopSuggestions` in sync, then calls `onStopsChanged()`
- `trip-planner.html`: `cdkDropList` + `(cdkDropListDropped)` on `.stop-list`; `cdkDrag` + `[cdkDragDisabled]` (disabled for origin, destination, and while loading) on each row; `cdkDragHandle` grip icon shown only for via stops; `*cdkDragPreview` shows stop name with grip icon; `*cdkDragPlaceholder` renders dashed empty slot
- `trip-planner.css`: `.stop-drag-handle` (grab cursor, right-aligned); `.stop-drag-preview` (white card + box-shadow); `.stop-drag-placeholder` (dashed border); CDK animation transitions
