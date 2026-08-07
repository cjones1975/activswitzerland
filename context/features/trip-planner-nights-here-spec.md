# Trip Planner Step 2: "Nights here" Relabel + Day-0 Fix

## Goal

Two related changes to the Step 2 itinerary builder:

1. Relabel "Days here" → "Nights here" — the field the user already fills in per stop is really
   asking "how many nights do I sleep here," which is both the more intuitive framing and the unit
   the upcoming hotel-selection feature will need (checkout = arrival + nights). No behavior change
   from this alone — same field, same value, same `0` = Transit meaning.
2. Fix the "Day 0" label: a transit stop (0 nights) that occurs before any real stay has been
   allocated currently shows "Day 0" instead of "Day 1." Root cause and fix are in
   `stopDayRanges()` (`shared/utils/date-range.ts`) — the day-numbering algorithm, not the input
   field itself.

No `TripStop`/`PlannedTrip` model changes — `days` stays the field name (same reasoning as the
"Start trip"/"End trip" relabel in `trip-planner-itinerary-transit-spec.md`: only the label and the
derived display change, not the stored shape).

## 1. Day-numbering fix (`shared/utils/date-range.ts`)

Current `stopDayRanges()` walks the stops with a `currentDay` pointer starting at `0`. A transit
stop (`days === 0`) is labeled `{ start: currentDay, end: currentDay }` without advancing the
pointer — correct in spirit (it borrows whatever day is "in progress"), but since the pointer
starts at `0`, a transit stop with nothing allocated before it reads "Day 0."

Fix: start the pointer at `1` instead of `0`, and change how a real (>0 night) stop claims its
span so it starts *at* the pointer rather than *after* it — otherwise a leading transit stop and
the stay immediately following it would report different days for what's actually the same travel
day (e.g. "Day 1: transit through Bern" followed by "Days 2–3: Lucerne" instead of the correct
"Day 1: transit through Bern" → "Days 1–2: Lucerne", both covering the actual arrival day).

```ts
/**
 * "Day N" / "Days N–M" per stop, derived by walking the itinerary and accumulating nights spent.
 * `stop.days` is entered by the user as nights, not calendar days — a stop with N>0 nights spans
 * N calendar days starting at the current day pointer. A 0-night stop (transit / pass-through)
 * doesn't advance the pointer — it's labeled with whichever day is already in progress: Day 1 if
 * nothing has been allocated yet, otherwise the same day the next real stay starts on. This means
 * a leading or mid-trip transit stop always shares a day with the stay it leads into, never gets
 * an orphan day of its own, and — the fix this replaces — never reads "Day 0."
 */
export function stopDayRanges(stops: TripStop[]): Map<string, { start: number; end: number }> {
  const ranges = new Map<string, { start: number; end: number }>();
  let currentDay = 1;
  for (const stop of stops) {
    if (stop.days > 0) {
      const start = currentDay;
      const end = currentDay + stop.days - 1;
      ranges.set(stop.id, { start, end });
      currentDay = end + 1;
    } else {
      ranges.set(stop.id, { start: currentDay, end: currentDay });
    }
  }
  return ranges;
}
```

Worked example (5-night trip, matches `totalTripDays`): Transit departure (0) → Lucerne (2) →
Transit via-stop (0) → Interlaken (3, destination).

| stop | old label | new label |
|---|---|---|
| Departure (transit) | Day 0 | **Day 1** |
| Lucerne | Days 1–2 | Days 1–2 (unchanged) |
| Via (transit) | Day 2 | **Day 3** |
| Interlaken | Days 3–5 | Days 3–5 (unchanged) |

Only labels touching a transit stop change; every stay-to-stay boundary with no transit stop
between them is byte-for-byte identical to today's output, since the new formula reduces to the
same arithmetic once there's no `0`-night stop to borrow a day from. `stopDayOptions()`
(`date-range.ts`) and every caller of `stopDayRanges()` — Step 2, Step 3's day-picker and
visibility filter, Step 4's timeline — consume its `{start, end}` output as-is and need no changes
of their own; they inherit the fix automatically.

Correction (found post-implementation): trip-completion math was *not* unaffected. Sum of nights
across all stops === total trip days − 1, not total trip days — `remainingDays` in
`step2-itinerary.ts` was comparing `allocatedDays()` (nights) against `totalTripDays()` (calendar
days), always leaving exactly 1 falsely "unallocated" night on any fully-allocated itinerary. Fixed
by introducing `totalTripNights` (`totalTripDays() - 1`) and comparing against that instead.

## 2. i18n relabel

Value-only changes (keys unchanged, same pattern as the Start/End trip relabel) —
`trip.planner.step2` namespace in `i18n/{en,de,fr,it}.json`:

| key | en | de | fr | it |
|---|---|---|---|---|
| `daysHere` | "Days here" → "**Nights here**" | "Tage hier" → "**Nächte hier**" | "Jours ici" → "**Nuits ici**" | "Giorni qui" → "**Notti qui**" |
| `dayRemaining` | "{{count}} day left to allocate" → "{{count}} **night** left to allocate" | "Noch {{count}} Tag zu verteilen" → "Noch {{count}} **Nacht** zu verteilen" | "Encore {{count}} jour à répartir" → "Encore {{count}} **nuit** à répartir" | "Ancora {{count}} giorno da assegnare" → "Ancora {{count}} **notte** da assegnare" |
| `daysRemaining` | "{{count}} days left to allocate" → "{{count}} **nights** left to allocate" | "Noch {{count}} Tage zu verteilen" → "Noch {{count}} **Nächte** zu verteilen" | "Encore {{count}} jours à répartir" → "Encore {{count}} **nuits** à répartir" | "Ancora {{count}} giorni da assegnare" → "Ancora {{count}} **notti** da assegnare" |
| `dayOverBudget` | "{{count}} day over your trip length" → "{{count}} **night** over your trip length" | "{{count}} Tag zu viel für die Reiselänge" → "{{count}} **Nacht** zu viel für die Reiselänge" | "{{count}} jour de trop pour la durée du voyage" → "{{count}} **nuit** de trop pour la durée du voyage" | "{{count}} giorno in eccesso rispetto alla durata del viaggio" → "{{count}} **notte** in eccesso rispetto alla durata del viaggio" |
| `daysOverBudget` | "{{count}} days over your trip length" → "{{count}} **nights** over your trip length" | "{{count}} Tage zu viel für die Reiselänge" → "{{count}} **Nächte** zu viel für die Reiselänge" | "{{count}} jours de trop pour la durée du voyage" → "{{count}} **nuits** de trop pour la durée du voyage" | "{{count}} giorni in eccesso rispetto alla durata del viaggio" → "{{count}} **notti** in eccesso rispetto alla durata del viaggio" |

`dayRemaining`/`daysRemaining`/`dayOverBudget`/`daysOverBudget` switch to "night(s)" too — they're
feedback shown while the user is filling in the (now "Nights here") fields, so they should describe
the same unit the user is typing into, not the trip's overall day length.

**Explicitly unchanged** (these describe the trip's overall calendar length or a resolved calendar
day, not a per-stop night count, so "day" is still the correct word):
- `tripRange`/`daysTrip` — Step 1's total-trip-length banner.
- `dayLabel`/`dayRangeLabel` ("Day {{start}}" / "Days {{start}}–{{end}}") — the *output* pill shown
  next to each stop, still a calendar day number (that's the whole point: nights in → day range
  out).
- `dayDateLabel` — Step 3's per-day activity option label.

## 3. No markup/CSS changes required

`step2-itinerary.html`'s three `.s2-days-field` blocks already bind to the `daysHere` key and to
`daysFor()`/`onDaysChange()`/`isTransit()` — untouched, since none of those are renamed.
`.s2-days-field > label` has no fixed width (flex item, auto-sized), so "Nights here" being three
characters longer than "Days here" needs no CSS change — flagged in the verification plan below
purely as a check, not an expected fix.

## Out of scope

- No `TripStop.days` → `nights` field rename. Purely a label + algorithm fix.
- No change to the Transit checkbox mechanism (`isTransit()`/`onTransitToggle()`/
  `DEFAULT_STOP_DAYS`) — still derived from `days === 0`, unchanged.
- No change to Step 3 or Step 4 markup/logic — they inherit the corrected day ranges automatically
  through the shared `stopDayRanges()` import.
- Hotel selection itself is a separate, not-yet-scoped feature; this spec only sets up the
  nights-based framing it'll build on.

## Verification plan

`tsc --noEmit`; live check via `ng serve`:
- Build a trip with a transit departure (nothing allocated yet) — confirm it now shows "Day 1," not
  "Day 0."
- Build a trip with a transit via-stop *between* two real stays — confirm it shares the following
  stay's starting day rather than getting an orphan day number.
- Build a trip with no transit stops at all — confirm day ranges are pixel-for-pixel identical to
  today's output (regression check on the "unchanged when there's no transit" claim above).
- Confirm "Nights here" (and its de/fr/it equivalents) renders without wrapping to a second line on
  a narrow mobile width, on the departure, via, and destination cards.
- Confirm the remaining/over-budget message under the stop list now reads "night(s)" instead of
  "day(s)" in all four languages, and still triggers/clears at the same allocation totals as before
  (same underlying `remainingDays` arithmetic, only the copy changed).
- Confirm Step 3's per-stop day pill and day-of-activity picker, and Step 4's timeline day pills,
  all reflect the corrected numbering with no extra changes needed on those pages.

## References

- @frontend/src/app/shared/utils/date-range.ts
- @frontend/src/app/features/trip-planner/step2-itinerary/step2-itinerary.ts
- @frontend/src/app/features/trip-planner/step2-itinerary/step2-itinerary.html
- @frontend/src/app/features/trip-planner/step3-activities/step3-activities.ts
- @frontend/src/app/features/trip-planner/step4-summary/step4-summary.ts
- @frontend/public/i18n/en.json (`trip.planner.step2` namespace, and its de/fr/it equivalents)
- context/features/trip-planner-itinerary-transit-spec.md (the Transit checkbox + Start/End trip
  relabel this spec builds on)
