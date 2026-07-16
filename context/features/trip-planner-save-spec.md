# Trip Planner — Step 5 (Save Trip)

## Why

Phase 4 of the trip planner rebuild (see `trip-planner-rebuild-spec.md`'s Phase 4 pointer
section) — the final wizard step. The user names the trip they just built across Steps 1-4
and saves it to their account. The wizard shell already reserves this step
(`STEP_KEYS` includes `'save'`, `trip-planner-wizard.html`'s `@switch` falls through to the
`@default` placeholder for `@case (5)` today) and Profile already has a working saved-trips
list (`features/auth/profile/`: `getTrips`/`viewTrip`/`deleteTrip` against `TripsService`) —
this phase is what actually produces a trip for that list to show, plus the backend schema
that can hold one. Mockup: `context/screenshots/TripPlanner7 - Save Trip.png`
(journey/shape reference only, not a pixel spec — see the master spec's note on mockups).

## Confirmed decisions

- **Backend `Trip.js` is fully replaced** (per the master spec, no migration). The current
  schema (`stationId`/`attractionIds`, no `dateMode`/`range`/`connections`/`activities`) predates
  the rebuild entirely and can't hold a `PlannedTrip`. Old documents in Mongo are simply
  orphaned — acceptable, already called out in the master spec's overview.
- **Create vs. update is decided by whether the trip in progress was loaded from a saved
  trip.** `TripPlannerService` gains a `loadedTripId` signal, set by `loadSavedTrip()` (which
  today discards `trip._id` entirely) and cleared by `reset()`/`setType()`. Step 5 saves via
  `TripsService.updateTrip(id, ...)` when set, `saveTrip(...)` otherwise — avoids silently
  duplicating a trip every time a user reopens one from Profile (`viewTrip()`), edits an
  activity, and saves again. After a successful *create*, the returned `_id` is written back
  into `loadedTripId` so a second Save press in the same session updates in place too.
- **`profile.ts`'s `viewTrip()` jumps straight to Step 4 (Summary), not Step 1.** The master
  spec called for "a one-shot flag" for this; no flag is actually needed — `plannerSvc.step`
  is already a public writable signal, so `viewTrip()` just adds `this.tripPlannerSvc.step.set(4)`
  next to the existing `loadSavedTrip(trip)` call, before navigating to `/trip-planner`. Landing
  on Summary (not Save) matches "View" being a read-first action; the user reaches Step 5
  themselves via Summary's existing Continue button if they want to rename/re-save.
- **Trip name is pre-filled with a suggested value, editable**, matching the mockup's "My
  Swiss Road Trip" placeholder text (not literally empty with a placeholder hint, despite the
  pre-existing `tripNamePlaceholder: "Suggested"` i18n key's phrasing — that key is dropped,
  see i18n below). Suggested value: `trip.planner.step5.suggestedRoad` /
  `suggestedRail` ("My Swiss Road Trip" / "My Swiss Rail Trip") depending on `trip().type`,
  computed once when the trip has no `name` yet. When editing a previously-saved trip
  (`loadedTripId()` set), the field pre-fills from `trip().name` instead. Save is disabled
  while the name is blank.
- **Summary block is simple label/value rows** (Type, Duration, Destinations, Activities),
  not Step 4's stat-tile cards — matches the mockup's plainer treatment for this step and
  visually distinguishes "final confirmation" from Summary's richer timeline. Values reuse
  the same computations Step 4 already has (`trip().type`, date-range/day-count formatting,
  `trip().stops.length`, `trip().activities.length`) — small, acceptable duplication across
  two components rather than a new shared abstraction for four one-line reads.
- **Anonymous users can reach Step 5 but can't save.** `/trip-planner` has no `authGuard` (by
  design — building a trip doesn't require an account). The pre-existing `saveHint` key
  ("Sign in to save your trips") is shown under the name field whenever `!auth.isLoggedIn()`;
  clicking Save Trip in that state opens the `'auth'` drawer (`drawer.open('auth')`, same
  mechanism `menu-nav`'s login button uses) instead of calling the API. The drawer stacks on
  top of `'trip-planner'`, so once the user logs in and closes it, they're back on Step 5 with
  `auth.isLoggedIn()` now true and Save working normally — no redirect/reload needed.
- **Unresolved rail connections never block Save** — already decided in the master spec
  ("Saving (Step 5) is allowed with unresolved connections... can be reopened later to finish
  picking them"). Step 5 shows no connection-related UI at all (Summary already owns that
  banner).
- **On successful save, the trip-planner drawer auto-collapses** (`drawer.collapse('trip-planner')`),
  reusing the exact reveal-the-map mechanism Step 4's "Map View" button already uses — the
  saved route becomes visible on the map immediately, and the existing "reopen trip planner"
  button (`trip-planner-layout.html`) brings the user straight back to Step 5 (now reading
  "Update Trip", since `loadedTripId` is set) if they want to keep editing. A toast
  (`trip.planner.savedSuccess`, "Trip saved!" — already an existing key) confirms the save
  regardless.
- **"Browse Saved Trips" is a plain nav shortcut to `/auth/profile`, not a new list UI** — per
  the master spec ("no separate browse-trips UI needed here"). Shown as a secondary button
  below Save Trip, always available (not gated on having just saved), consistent with the
  mockup's persistent second button. Profile's saved-trips grid (already built) is the only
  place trips are browsed/deleted.

## Backend — `backend/src/models/Trip.js` (fully replaced)

Schema mirrors `frontend/src/app/models/trip.ts` exactly (field names, optionality):

```js
const TripDateRangeSchema = new mongoose.Schema({
  mode: { type: String, enum: ['dates', 'days'], required: true },
  startDate: String, endDate: String,
  startDay: Number, endDay: Number,
}, { _id: false });

const TripStopSchema = new mongoose.Schema({
  id: { type: String, required: true },
  role: { type: String, enum: ['departure', 'destination', 'stop'], required: true },
  name: { type: String, required: true },
  lat: { type: Number, required: true },
  lon: { type: Number, required: true },
  externalId: String,
  days: { type: Number, required: true },
}, { _id: false });

const TripSectionStopSchema = new mongoose.Schema({ time: String, station: String, platform: String }, { _id: false });
const TripSectionJourneySchema = new mongoose.Schema({ name: String, category: String, number: String, direction: String }, { _id: false });
const TripSectionSchema = new mongoose.Schema({
  type: { type: String, enum: ['journey', 'walk'] },
  departure: TripSectionStopSchema,
  arrival: TripSectionStopSchema,
  journey: TripSectionJourneySchema,
  walkDuration: Number,
}, { _id: false });

const TripConnectionSchema = new mongoose.Schema({
  from: String, to: String, departure: String, arrival: String, duration: String,
  transfers: Number, products: [String], routeCoordinates: [[Number]],
  sections: [TripSectionSchema],
}, { _id: false });

const TripConnectionLegSchema = new mongoose.Schema({
  fromStopId: { type: String, required: true },
  toStopId: { type: String, required: true },
  connection: TripConnectionSchema,
  skipped: Boolean,
}, { _id: false });

const TripActivitySchema = new mongoose.Schema({
  id: { type: String, required: true },
  stopId: { type: String, required: true },
  kind: { type: String, enum: ['attraction', 'hike', 'bike'], required: true },
  refId: { type: String, required: true },
  day: { type: mongoose.Schema.Types.Mixed, required: true }, // ISO date string or relative day number
  name: { type: String, required: true },
  lat: Number, lon: Number, distanceKm: Number,
  category: { type: String, enum: ['national', 'regional', 'local'] },
}, { _id: false });

const TripSchema = new mongoose.Schema({
  user:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:             { type: String, required: true, trim: true },
  type:             { type: String, enum: ['road', 'rail'], required: true },
  dateMode:         { type: String, enum: ['dates', 'days'], required: true },
  range:            { type: TripDateRangeSchema, required: true },
  stops:            { type: [TripStopSchema], required: true },
  connections:      { type: [TripConnectionLegSchema], default: [] },
  activities:       { type: [TripActivitySchema], default: [] },
  routeCoordinates: { type: [[Number]], default: [] },
  createdAt:        { type: Date, default: Date.now },
});
```

`backend/src/controllers/trips.js`: `createTrip` destructures
`{ name, type, dateMode, range, stops, connections, activities, routeCoordinates }` from
`req.body` (was `{ name, type, stops, attractionIds, routeCoordinates }`). `getTrips`,
`updateTrip` (already passes `req.body` through generically via `findByIdAndUpdate`), and
`deleteTrip` are unchanged. `backend/src/routes/trips.js` is unchanged.

## Frontend service — `shared/services/trip-planner.ts`

- New `readonly loadedTripId = signal<string | null>(null)`.
- `loadSavedTrip(trip: SavedTrip)`: sets `loadedTripId.set(trip._id ?? null)` alongside the
  existing `_trip$.next(planned)` / `_routeCoordinates$.next(...)`.
- `reset()` and `setType()`: add `this.loadedTripId.set(null)` (both already fully reset the
  rest of the trip state).
- No new save/update method here — Step 5 calls `TripsService` directly, mirroring how
  `profile.ts` already calls `TripsService.getTrips()`/`deleteTrip()` directly rather than
  proxying through `TripPlannerService`.

## `features/trip-planner/step5-save/` (new)

- `trip = toSignal(plannerSvc.trip$, ...)`, same pattern as Steps 3/4.
- `nameControl = new FormControl('', { nonNullable: true, validators: [Validators.required] })`,
  initialized in the constructor from `trip().name` if set, else the suggested default (see
  Confirmed decisions); re-synced only on that initial read, not reactively, so the user's
  edits aren't clobbered by unrelated trip-state changes.
- Summary rows: `type()`, `formattedRange()` (reuses Step 4's date-mode branch —
  `formatDdMmYyyy(start) — formatDdMmYyyy(end)` in `dates` mode, `"N days"` in `days` mode),
  `destinationCount()` (`trip().stops.length`), `activityCount()` (`trip().activities.length`).
- `saving = signal(false)`; `auth = inject(Auth)` for the sign-in gate.
- `save()`:
  ```ts
  save(): void {
    if (!this.auth.isLoggedIn()) { this.drawerSvc.open('auth'); return; }
    if (this.nameControl.invalid) return;
    this.saving.set(true);
    const payload: SavedTrip = { ...this.plannerSvc.snapshot, name: this.nameControl.value };
    const id = this.plannerSvc.loadedTripId();
    const req$ = id ? this.tripsSvc.updateTrip(id, payload) : this.tripsSvc.saveTrip(payload);
    req$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        if (saved._id) this.plannerSvc.loadedTripId.set(saved._id);
        this.plannerSvc.clearDraft();
        this.toast.success(this.translate.instant('trip.planner.savedSuccess'));
        this.drawerSvc.collapse('trip-planner');
      },
      error: () => this.saving.set(false),
    });
  }
  ```
  (`error` gets a `toast.error` with a generic message, no new i18n key needed — reuses the
  pattern `Auth`'s methods already follow.)
- `browseSavedTrips()`: `this.router.navigate(['/auth/profile'])`.
- `back()`: `this.plannerSvc.prevStep()` (→ Step 4).
- Footer: only Back + Save Trip / Update Trip (no Continue — this is the last step). Save
  button label switches on `plannerSvc.loadedTripId()`: `trip.planner.save` ("Save Trip") vs.
  a new `trip.planner.step5.update` ("Update Trip").

`trip-planner-wizard.html`: replace the `@default` placeholder's coverage of case 5 with
`@case (5) { <app-step5-save /> }`; import `Step5Save` into `TripPlannerWizard`.

## `features/auth/profile/profile.ts`

`viewTrip(trip)`:
```ts
viewTrip(trip: SavedTrip): void {
  this.tripPlannerSvc.loadSavedTrip(trip);
  this.tripPlannerSvc.step.set(4);
  this.router.navigate(['/trip-planner']);
}
```
(single line added next to the existing `loadSavedTrip` call — see Confirmed decisions for
why no separate flag is needed.)

## i18n

Reused as-is (already present, all four locales): `trip.planner.tripName`, `save` ("Save
Trip"), `saveHint`, `savedSuccess`, `back`.

Dropped: `trip.planner.tripNamePlaceholder` ("Suggested") — no longer applicable now that the
field is pre-filled with a real suggested value rather than showing a hint placeholder; remove
the key from all four locale files if nothing else references it (grep before removing).

New, `trip.planner.step5.*`: `suggestedRoad` ("My Swiss Road Trip"), `suggestedRail` ("My
Swiss Rail Trip"), `type`/`duration`/`destinations`/`activities` (summary row labels —
`destinations`/`activities` may be able to reuse Step 4's `trip.planner.step4.destinations`/
`activities` keys verbatim instead of duplicating), `update` ("Update Trip"),
`browseSavedTrips` ("Browse Saved Trips"). Exact key set finalized during implementation,
consistent with how prior steps' keys were finalized during their own implementation.

## Out of scope (deferred / not requested)

- Editing stops, dates, or activities from Step 5 — same as Summary, any such edit means
  going Back to the relevant step.
- A trip list/browse UI inside the wizard itself — "Browse Saved Trips" is a plain link out to
  the already-built Profile page.
- Renaming a trip after it's saved without re-entering the wizard (e.g. an inline rename on
  Profile's trip cards) — out of scope for this phase.
- Public/shareable trip links.
- Migrating existing Mongo `Trip` documents to the new schema — explicitly ruled out by the
  master spec.

## References

- @backend/src/models/Trip.js
- @backend/src/controllers/trips.js
- @backend/src/routes/trips.js
- @frontend/src/app/shared/services/trip-planner.ts
- @frontend/src/app/shared/services/trips.ts
- @frontend/src/app/models/trip.ts
- @frontend/src/app/features/trip-planner/step4-summary/step4-summary.ts
- @frontend/src/app/features/auth/profile/profile.ts
- @frontend/src/app/core/services/auth.ts
- @frontend/src/app/core/services/toast.ts
- @frontend/src/app/shared/services/drawer.ts
- @context/features/trip-planner-rebuild-spec.md
- @context/features/trip-planner-summary-spec.md
