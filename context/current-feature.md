# Current Feature

## Feature

Trip Planner Fixes — UX polish and bug fixes for the trip planner wizard.

## Status

Implemented on `feature/trip-planner-fixes`. Build passing.

## Goals

1. Place 'Plan a Trip' title text on the same row as the icon.
2. Selected `tripType` button gets background color `#285278`.
3. Make 'Add things to do' link more prominent (button style, icon, accent color).
4. Hide the Back button on the first wizard step.
5. Enforce linear step progression — Next is disabled until the current step is valid.
6. On the 'Save your trip' step, show 'View Trip' and 'Save Trip' side by side (100% width on mobile, 10px gap).
7. Remove `floatLabel` from the connections form.
8. Replace the connections time input with `p-datepicker [timeOnly]="true"` (supports both typing and picker).
9. Remove the 'Find Connections' button; Next button on that step triggers the search and advances.
10. On 'Choose a Connection', connections list fills the full screen height; Back/Next stay pinned at the bottom.
11. Connection card shows start → end time on a single row (e.g. `03:36 → 04:59`).

## Notes

- Full route expansion on the connection card is out of scope for this feature (future spec).
- Spec: `context/features/trip-planner-fixes-spec.md`

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
