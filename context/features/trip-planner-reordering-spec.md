# Trip Planner Stop Reordering Spec

## Overview

Allow the user to reorder the **via stops** (intermediate stops between the fixed origin and destination) on the **'Plan your route' step** of the wizard using drag-and-drop. This feature applies only to the stop list. The found **train connections on the 'Choose a connection' step are not reorderable** and are unaffected by this feature.

The origin (first stop) and destination (last stop) are always fixed. When round trip is enabled the destination is also locked, but via stops between them remain draggable.

---

## Implementation Library

Use **Angular CDK drag-drop** (`@angular/cdk/drag-drop`). It is already available in the Angular ecosystem and integrates cleanly with signal-based components.

```
npm install @angular/cdk  (if not already present)
```

Import `DragDropModule` from `@angular/cdk/drag-drop` into the `TripPlanner` component.

---

## Drag Handle

- Each **via stop row** (index > 0 and index < last) must show a drag handle on the **right side** of the row, aligned with the autocomplete input.
- The handle uses a grip icon: `fa-light fa-grip-dots-vertical` (or `fa-grip-vertical`).
- The handle is the only interactive drag target — the rest of the row (autocomplete, remove button) must remain clickable without initiating a drag.
- Use `cdkDragHandle` directive on the handle element.
- The **origin** (index 0) and **destination** (last index) rows must **not** show a drag handle and must **not** be draggable.

---

## Drag Behaviour

- Wrap the stop list with `cdkDropList` and each stop row with `cdkDrag`.
- Only via stops are wrapped in `cdkDrag` — origin and destination rows are plain divs.
- On `(cdkDropListDropped)`, call a `reorderStop(event)` handler that uses CDK's `moveItemInArray` to update the `stops` signal in place, then calls `onStopsChanged()` to recalculate the route.
- `stopSuggestions` must be reordered in the same operation to stay index-aligned.

---

## Visual Feedback

- While dragging, the dragged item should render a **preview** that matches the row width and has a subtle box-shadow to lift it off the list.
- The placeholder left behind in the list should be a **dashed-border empty slot** (same height as a stop row) so the user can see where the item will land.
- Use CDK's `*cdkDragPreview` and `*cdkDragPlaceholder` templates for this.
- No animation is required beyond CDK's default drop animation.

---

## Constraints

| Condition | Behaviour |
|---|---|
| Only 2 stops (origin + destination) | No drag handles shown; nothing to reorder |
| Round trip enabled | End stop is locked but via stops remain draggable |
| Stop is `null` (unfilled) | Via stop is still draggable (the empty slot can be repositioned) |
| `connectionsLoading` is true | Drag should be disabled (add `[cdkDragDisabled]` binding) |

---

## Route Recalculation

After a successful drop, call the existing `onStopsChanged()` method. This rebuilds the road route or rail route coordinates exactly as it does today when stops are added or removed.

---

## Out of Scope

- Dragging the origin or destination stop.
- Reordering the found train connections on the 'Choose a connection' step.
- Touch-specific long-press delay tuning (CDK handles touch by default).
- Persisting stop order to the server (order is part of the stops array already saved with the trip).
- Animated reorder without drag (up/down arrow buttons).
