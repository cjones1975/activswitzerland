# Trip Planner: Step-based Wizard

## Goal

Reorganize the `TripPlanner` drawer (`frontend/src/app/features/trip-planner/`) from a single
long-scroll form into a step-by-step wizard with Back/Next navigation. This is a template/state
reorganization on top of existing signals and services — no data-model or backend changes.

## Steps

- **Road** (2 steps):
  1. `stops` — trip type toggle, stop builder, "Add things to do" links
  2. `finish` — trip name, suggested name, Save Trip, View Trip, sign-in hint

- **Rail** (4 steps):
  1. `stops` — trip type toggle, stop builder, "Add things to do" links
  2. `schedule` — date/time pickers, "Find connections" button
  3. `connection` — connection results list, select one
  4. `finish` — trip name, suggested name, Save Trip, View Trip, sign-in hint

The "View trip" map preview (collapses the drawer to show the route on the map) is reachable
only from the final (`finish`) step.

## Component (`trip-planner.ts`)

```ts
type TripStep = 'stops' | 'schedule' | 'connection' | 'finish';

readonly steps = computed<TripStep[]>(() =>
  this.selectedType() === 'rail'
    ? ['stops', 'schedule', 'connection', 'finish']
    : ['stops', 'finish']
);

step = signal(0);
readonly currentStep = computed<TripStep>(() => this.steps()[this.step()]);

searchedConnections = signal(false);

readonly canGoNext = computed(() => {
  switch (this.currentStep()) {
    case 'stops':      return this.validStops().length >= 2;
    case 'schedule':   return this.connections().length > 0;
    case 'connection': return this.selectedConnection() !== null;
    default:           return false;
  }
});

readonly nextHint = computed<string | null>(() => {
  if (this.canGoNext()) return null;
  switch (this.currentStep()) {
    case 'stops':      return 'trip.planner.hints.selectStops';
    case 'schedule':   return 'trip.planner.hints.findConnections';
    case 'connection': return 'trip.planner.hints.selectConnection';
    default:           return null;
  }
});

goNext(): void {
  if (!this.canGoNext()) return;
  this.step.update(s => Math.min(s + 1, this.steps().length - 1));
}

goBack(): void {
  this.step.update(s => Math.max(s - 1, 0));
}
```

- `onTypeChange()`: also resets `step.set(0)` and `searchedConnections.set(false)` (type toggle
  only lives in step `'stops'`, so changing it always happens on step 0).
- `findConnections()`: sets `searchedConnections.set(true)` on completion (success or error).
- `onSave()`: on successful save, also calls `drawerSvc.collapse('trip-planner')` — "Save Trip"
  now both saves and shows the route on the map ("save and view trip"). The standalone "View
  Trip" button remains for viewing without saving.
- `showConnections` computed removed — superseded by the step switch.

## Template (`trip-planner.html`)

`@switch (currentStep())` over the four cases (only `'stops'`/`'finish'` reachable for road),
each with a `.tp-section-title` heading (`trip.planner.steps.*`). Below the switch, a sticky
`.tp-step-nav` bar with:
- an optional hint message (`nextHint()`)
- Back button (disabled on step 0)
- step-dot progress indicator
- Next button (hidden on `'finish'`, disabled until `canGoNext()`)

`'schedule'` step shows a "no connections found" `p-message` when
`searchedConnections() && !connectionsLoading() && connections().length === 0`.

## i18n (`trip.planner.*`, all four locales)

New keys: `back`, `next`, `steps.{stops,schedule,connection,finish}`,
`hints.{selectStops,findConnections,selectConnection}`, `noConnections`.

## Verification

- `tsc --noEmit` + `ng build --configuration development`
- Browser walkthrough of both road and rail flows (step transitions, validation gating,
  save/view behavior, road↔rail switch resets to step 1 with correct step count)
