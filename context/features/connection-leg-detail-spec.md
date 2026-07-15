# Connection Leg Picker — Restore Rich Journey Detail

## Why

The Phase 1 trip planner rebuild replaced the old wizard's rich connection cards with a
flat one-line summary (`connection-leg-picker.html`'s `.leg-conn-card`/`.leg-picked`) — a
real regression, not an intentional simplification. The underlying data was never lost:
`TripConnection.sections` / `TripSection` / `TripSectionStop` / `TripSectionJourney`
(`models/trip.ts`) are untouched, and `TransportService.getConnections()` still populates
them via `mapSections()`. This is a straight port of markup/CSS/helpers into the new
component, not new design work.

## Source

The full rich UI being restored last existed at commit `cd1a672` (before Phase 1 deleted
`features/trip-planner/trip-planner.ts/.html/.css`):
- Markup: `trip-planner.html` lines ~198–286 (`.conn-card` → header/meta/timeline →
  expandable `.conn-detail` iterating `conn.sections`, journey vs. walk sections)
- Styles: `trip-planner.css` — all `.conn-*` rules (~line 286–530)
- Component logic: `trip-planner.ts` — `toggleDetail()`, `formatPlatform()`, `formatWalk()`,
  `firstTrainDeparture()`, `lastTrainArrival()`, `trainColor()`, `categoryLabel()`,
  `isSelectedConnection()` (`formatTime()`/`formatDuration()` already exist in the current
  component)

## Target

`frontend/src/app/features/trip-planner/step2-itinerary/connection-leg-picker/` — both
places a connection is currently rendered flatly get the same rich treatment:
- **Search results** (`connections()` list, not yet picked) — each result becomes a
  `.conn-card` with header (route + expand chevron), meta row (transfers/duration),
  timeline bar, and expandable per-section detail. Click-to-select stays on the card body
  (as today); the chevron toggles detail independently, same interaction split as before.
- **Already-picked connection** (`leg().connection`, replacing today's `.leg-picked`
  summary line) — same `.conn-card` treatment, always shown selected, still expandable to
  see the full journey breakdown after the fact.

Only one connection's detail expanded at a time within a given leg (mirrors the old
`expandedConnectionIndex`), independent of the leg's own search-form expand/collapse state.

## Out of scope

No model or backend changes. No change to the search form, date/time inputs, or
skip/pick flow. Not part of Phase 2 (Activities) — sequenced before it purely because it's
a gap left by Phase 1, not because Activities depends on it.

## References

- @frontend/src/app/features/trip-planner/step2-itinerary/connection-leg-picker/connection-leg-picker.ts
- @frontend/src/app/features/trip-planner/step2-itinerary/connection-leg-picker/connection-leg-picker.html
- @frontend/src/app/features/trip-planner/step2-itinerary/connection-leg-picker/connection-leg-picker.css
- @frontend/src/app/models/trip.ts
- Old implementation: `git show cd1a672:frontend/src/app/features/trip-planner/trip-planner.html` / `.css` / `.ts`
