# Trip Planner Step 2/3: "Start trip"/"End trip" Relabel + Transit Checkbox

## Goal

Three related changes to `features/trip-planner/step2-itinerary/` and
`features/trip-planner/step3-activities/`:

1. Relabel "Departure" → "Start trip" and "Main Destination" → "End trip".
2. Add a "Transit" checkbox next to "Days here" on the departure stop and on via (added) stops,
   which is really just a convenience toggle for setting `days` to/from `0` — no new data-model
   field.
3. Change Step 3's stop-visibility filter so it's role-aware instead of a blanket `days > 0`.

## 1. Relabel

`i18n/{en,de,fr,it}.json`, `trip.planner.step2` namespace — change the **value** only, keys stay
`departure`/`destination` (both keys are reused as-is by Step 3's per-stop role label,
`'trip.planner.step2.' + stop.role`, so relabeling here relabels both steps for free):

| key | en (current → new) | de (current → new) | fr (current → new) | it (current → new) |
|---|---|---|---|---|
| `departure` | "Departure" → "Start trip" | "Abfahrt" → "Reisebeginn" | "Départ" → "Début du voyage" | "Partenza" → "Inizio del viaggio" |
| `destination` | "Main Destination" → "End trip" | "Hauptziel" → "Reiseende" | "Destination principale" → "Fin du voyage" | "Destinazione principale" → "Fine del viaggio" |

New key `trip.planner.step2.transit` (checkbox label), all four locales:
en "Transit", de "Transit", fr "Transit", it "Transito".

## 2. Transit checkbox

Applies to the departure card and every via-stop card in `step2-itinerary.html` — **not** the
destination card (destination already shows unconditionally in Step 3 regardless of days, so it
gets no checkbox).

- Checked state is **derived**, not a stored field: checked ⇔ `daysFor(stop) === 0`. No
  `TripStop` model change.
- `step2-itinerary.ts` gains:
  ```ts
  isTransit(stop: TripStop): boolean {
    return this.daysFor(stop) === 0;
  }

  onTransitToggle(stop: TripStop, checked: boolean): void {
    this.plannerSvc.updateStopDays(stop.id, checked ? 0 : DEFAULT_STOP_DAYS);
  }
  ```
- Days-here `<input>` gains `[disabled]="isTransit(stop)"` on both the departure and via cards —
  while checked, the input shows the forced `0` greyed out rather than looking editable but
  ineffective.
- Unchecking resets to `DEFAULT_STOP_DAYS` (1), same constant/value already used as the default
  for a freshly-picked stop elsewhere in this file.
- **Departure default**: `applyDeparture()`'s fallback changes from
  `existing?.days ?? DEFAULT_STOP_DAYS` to `existing?.days ?? 0` — a brand-new departure pick
  (no `existing` stop yet, i.e. first pick into an empty slot) defaults to Transit-checked/0
  days. Picking a *different* location into an already-populated departure slot keeps
  `existing.days` untouched (same "only fills in when there's nothing there yet" behavior the
  line already has today) — so an already-set day count is never silently discarded by a
  location change. `applyAddStop()`/`applyDestination()` are unchanged (`DEFAULT_STOP_DAYS`, i.e.
  via/destination stops default unchecked at 1 day).
- Markup (both departure and via cards' `.s2-days-field`): add, after the existing
  label+input, a checkbox+label pushed to the row's far right end:
  ```html
  <div class="s2-days-field">
    <label>{{ 'trip.planner.step2.daysHere' | translate }}</label>
    <input type="number" [ngModel]="daysFor(stop)" (ngModelChange)="onDaysChange(stop, $event)"
           min="0" [attr.max]="totalTripDays()" [disabled]="isTransit(stop)" />
    <span class="s2-transit-field">
      <input type="checkbox" id="transit-{{stop.id}}" [ngModel]="isTransit(stop)"
             (ngModelChange)="onTransitToggle(stop, $event)" />
      <label for="transit-{{stop.id}}">{{ 'trip.planner.step2.transit' | translate }}</label>
    </span>
  </div>
  ```
  (destination card's `.s2-days-field` is untouched — no transit span there.)
- CSS (`step2-itinerary.css`): `.s2-transit-field` gets `margin-left: auto; display: flex;
  align-items: center; gap: 0.3rem; flex-shrink: 0;` to sit pinned at the row's far right without
  wrapping — `.s2-days-field` is already `display: flex`, so `margin-left: auto` on the last
  child pushes it there for free. Reduce `.s2-days-field input`'s `width` from `4.5rem` to
  `3.5rem` (2-3 digit day counts fit fine) to guarantee room for the checkbox+"Transit" label on
  one row at narrow mobile widths — a plain checkbox + a single short word (longest translation
  is "Transito", 8 chars) should not wrap in practice, but the narrower input is cheap insurance
  the user explicitly asked for if needed.

## 3. Step 3 visibility filter

`step3-activities.ts`'s `visibleStops` currently is a blanket `this.trip().stops.filter(s => s.days > 0)`
— every 0-day stop is hidden regardless of role. New rule, role-aware:

- **Departure** ("Start trip"): hidden when `days === 0` (unchanged behavior — this is exactly
  what the Transit checkbox is for: a pure pass-through start point with nothing to plan).
- **Via stops** (added stops): always shown, even at `days === 0`.
- **Destination** ("End trip"): always shown, even at `days === 0`.

```ts
readonly visibleStops = computed(() =>
  this.trip().stops.filter(s => s.role !== 'departure' || s.days > 0)
);
```

No template change needed beyond this — `step3-activities.html` already renders whatever
`stopDayLabels().get(stop.id)` resolves to (`undefined` for a 0-day stop, so the day-range pill
just doesn't render, same fallback Step 4's summary already relies on for its own 0-day
pass-through stops).

## Out of scope

- No `TripStop`/`PlannedTrip` model changes (no new `isTransit` field — derived from `days`).
- No change to Step 4 (Summary) — it already treats a 0-day stop as a slim pass-through marker
  regardless of role (per the trip-planner-summary-connections feature).
- No change to `daysHere`/`stop` i18n keys, `noStops` empty-state copy, or any other step2/step3
  strings not listed above.

## Verification plan

`tsc --noEmit`; live check via `ng serve`: create a road and a rail trip, confirm "Start trip"/
"End trip" render in Step 2 and as the per-stop role label in Step 3; confirm the departure
Transit checkbox starts checked with Days here disabled at 0 on first pick, toggling it on a via
stop zeroes its days and disables the input, unchecking restores 1 day and re-enables it; confirm
Step 3 hides a 0-day departure but shows 0-day via/destination stops with their activity pickers
still usable; confirm the checkbox+"Transit" label never wraps to a second line at a narrow
mobile width in all four languages.
