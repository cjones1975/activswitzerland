# Misc Fixes 2 Spec

## Overview

Quality and robustness improvements across the app: trip draft persistence, async error states, map marker performance, desktop footer nav resolution, and accessibility baseline.

---

## 1. Trip Planner — Draft Persistence via localStorage

The trip planner currently resets on `ngOnDestroy`, losing all in-progress work if the user navigates away accidentally.

`TripPlannerService` must save a draft snapshot to `localStorage` whenever the planner state changes (stops, type, name, selected connection). On mount, if a draft exists it must be restored before the component renders. The draft must be cleared on explicit save or when the user manually resets.

- Key: `activ_trip_draft`
- Payload: serialised `TripPlannerSnapshot` (stops, type, name, routeCoordinates)
- Write: debounced on every state change (300ms) to avoid excessive writes
- Clear: on successful `onSave()` and on `onTypeChange()` reset

---

## 2. Async Error States — Inline Feedback

Several async operations fail silently. Each must show an inline `p-message severity="warn"` or `severity="error"` in the relevant section when the call fails.

| Operation | Location | Current behaviour | Required |
|---|---|---|---|
| Road route calculation (`buildRoadRoute`) | Stop builder section | Silent | Inline error below stop list |
| Attraction load failure (vertical list, all-attractions, things-to-do) | Each list | Silent / stays on skeleton | Inline error replacing skeleton |
| Attraction detail load failure | Attraction detail drawer | Silent | Inline error in drawer body |

Connection search already has error handling via `searchedConnections`. Do not change it.

---

## 3. Map — Diff-Based Marker Updates

`syncMarkers()` currently tears down and rebuilds every marker on every `markers` input change. As attraction counts grow this causes visible flicker and wasted DOM work.

Replace the full rebuild with a diff approach:
- On each `ngOnChanges` for `markers`, compare the new array against the current `markerInstances` by marker `id` (or `lng,lat` key for markers without id).
- Only remove markers that are no longer present; only add markers that are new.
- Update `highlight` and `color` in place on unchanged markers without removing and re-adding them.

The popup instance map (`popupInstances`) must be kept in sync with the same diff logic.

---

## 4. Desktop Footer Nav — Content or Removal

Keep the footer nav visible only on pages that render a full-screen map (`/destinations/:id`, `/trip-planner`, `/trip-planner/:id`). Hide it completely on all other routes via a host-binding or a route-data flag read by the footer-nav component.


---

## 5. Accessibility Baseline

Address the most impactful gaps without a full WCAG audit.

### 5a. Autocomplete stop inputs
Each `p-autoComplete` on the stops step must have an `aria-label` reflecting its role:
- Index 0: `"From"`
- Index last: `"To"`
- All others: `"Via stop {{index}}"`

### 5b. Icon-only buttons
All icon-only interactive elements must have either `aria-label` or a visually-hidden `<span>` with descriptive text:
- Drawer close buttons (`menu-close`)
- Drawer collapse/map buttons
- Stop remove buttons
- Stop drag handles

### 5c. Drag-and-drop keyboard alternative
The CDK drag-drop stop reordering has no keyboard path. Add **Move up** and **Move down** buttons to via-stop rows (visible only on keyboard focus via `:focus-within` on the stop row) that call `reorderStop` with synthetic indices. Screen reader users can then reorder stops without a pointing device.

---

## 6. Trip Planner — Finish Step: Stop & Attraction Summary

On the **finish** (Save Trip) step, display a read-only summary of the planned trip above the trip-name field. The summary gives the user a final review before saving.

### Layout

Render one row per valid stop in order (origin → via stops → destination). Each row shows:

- The stop sequence indicator (matching the existing start / mid / end icon style from the stop builder)
- The stop name

If the stop has one or more attractions selected via "Things to do", render a toggleable panel immediately below the stop row. If no attractions were selected, the panel is omitted entirely.

### Attraction panel

Use PrimeNG `p-panel` with `[toggleable]="true"` and `[collapsed]="true"` as the default state. The panel header must show the attraction count (e.g. **3 attractions**). The panel body lists each attraction by name with a small `fa-solid fa-location-dot` icon prefix.

Data is sourced from the existing service methods:
- `plannerSvc.getSelections(stop.stationId)` → array of attraction IDs for that stop
- `plannerSvc.getAttraction(id)` → `Attraction` object from the cache

Both methods are already available in `TripPlanner` — no new service changes required.

### Example structure (single stop with attractions)

```
● Lausanne
  ┌─ 2 attractions ▾ ──────────────────────┐
  │  📍 Château de Chillon                 │
  │  📍 Olympic Museum                     │
  └────────────────────────────────────────┘
```

### Notes

- The summary is display-only; it must not allow editing stops or removing attractions from this step.
- The connecting dashed line between stop indicators should continue through the panel (same visual rhythm as the stop builder).
- If all stops are empty (no valid stops), the summary section is not rendered.

---

## Out of Scope

- Full WCAG 2.1 AA audit.
- Service worker / offline support.
- Map clustering for high-density attraction areas.
