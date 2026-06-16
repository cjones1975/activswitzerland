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
