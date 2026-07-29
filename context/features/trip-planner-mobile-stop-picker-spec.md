# Trip Planner Mobile Stop Picker — Full-Screen Search Sheet

**Status: implemented** (`feature/trip-planner-mobile-stop-picker`, not yet merged — not yet
exercised in a real browser/mobile viewport, only `tsc --noEmit`/`ng build` verified).

## Overview

Step 2 of the trip planner (`Step2Itinerary`) uses PrimeNG's `p-autoComplete` (`[dropdown]="false"`,
typeahead overlay) for all four stop fields — departure, each via stop, destination, and the
"Add stop" field. On mobile, once a few via stops have been added and the user scrolls down to
edit a field near the bottom of the list, opening that field's suggestion overlay is clunky: the
overlay is positioned relative to the field, and between the on-screen keyboard eating most of the
remaining viewport and the field's position mid-scroll, the dropdown clips, flips awkwardly, or is
partially hidden — reported directly by the user as frustrating on mobile.

This phase replaces the *interaction*, not the visual field itself, on narrow viewports only: on
screens ≤767px (the breakpoint `drawer-host.css` already uses), tapping any stop field opens a
dedicated full-screen search sheet — a fixed-position overlay with a search input pinned at the
top and results filling the rest of the screen, independent of where the field sits in the
scrolled card list. Desktop is completely unaffected; the existing `p-autoComplete` behavior there
is untouched.

## Confirmed decisions

- **CSS-only breakpoint gating, no `BreakpointObserver`/`matchMedia`.** Grepped the whole frontend —
  this codebase has zero JS-driven responsive breakpoint detection anywhere; every existing
  mobile/desktop split (`drawer-host.css`, `search-box.css`, `search-page.css`) is a plain
  `@media (max-width: ...)` CSS rule. Matching that convention: each of the four field slots
  renders **two markup blocks** bound to the same underlying signal — the existing
  `<p-autoComplete>` (hidden via CSS below 767px) and a new plain `<button>` styled to look like
  the same field (hidden via CSS above 767px, i.e. shown only on mobile). Only one is ever
  interactive at a time; no dual-binding conflicts since the hidden one is never focused/clicked.
- **Not fighting PrimeNG's `AutoComplete` internals a second time.** The Trip Planner Page
  Redesign's own history (`context/current-feature.md`, 2026-07-28 entry) already tried
  `appendTo="body"` on these exact four fields to fix a different overlay-positioning issue, hit a
  real focus-steal bug from PrimeNG's `forceSelection` re-validating on every internal `hide()`,
  and reverted it back to plain autocompletes per explicit user request. Given that history, this
  phase deliberately does **not** try to reposition/portal PrimeNG's own overlay for mobile — it
  replaces the whole interaction with a separate, custom-built sheet component that never touches
  `p-autoComplete`'s overlay machinery at all.
- **New component**: `LocationSearchSheet` (`features/trip-planner/step2-itinerary/location-search-sheet/`,
  sibling of `connection-leg-picker/`), mounted **once** in `step2-itinerary.html` (not once per
  field) — a `mobilePickerTarget` signal on `Step2Itinerary` tracks which slot is being edited
  (`'departure' | 'destination' | 'add' | { via: string } | null`), and the sheet's `(selected)`
  output routes back through the exact same `applyDeparture`/`applyDestination`/`applyVia`/
  `applyAddStop` private methods already used by the desktop path — no duplicated apply logic.
- **Self-contained, not reusing `search()`/`searchDeparture()` etc.** The sheet owns its own query
  signal, its own `Subject` + `debounceTime(300)` + `distinctUntilChanged()` + `switchMap` (PrimeNG's
  `AutoComplete` debounces internally via its own `completeMethod` delay, which doesn't apply to a
  plain `<input>`), and calls `TransportService.searchLocations()` directly — the only reuse point
  with the desktop path is that shared service call, not the four existing `search*` methods (which
  are bound to PrimeNG's `completeMethod` event shape and stay desktop-only).
- **Selection-only, no `commitTypedText()` equivalent needed.** Desktop's `commitTypedText()`
  exists to handle "user typed text but didn't click a suggestion" (blur/Enter revert-or-commit
  logic — see its doc comment in `step2-itinerary.ts`). The mobile sheet has no such ambiguous
  state: the only way to set a value is tapping a result row, so this whole class of fragility
  simply doesn't exist on the mobile path.
- **"Add stop" gets simpler on mobile, not more complex.** Desktop's `startAddStop()` reveals an
  inline autocomplete + a separate Cancel button (`addingStop` signal). On mobile, tapping
  "+ Add stop" opens the sheet directly in `'add'` mode; closing the sheet without picking a
  result is equivalent to Cancel (no separate cancel button needed) — `addingStop`/`cancelAddStop()`
  stay desktop-only, gated the same way as the field markup.
- **Clearing an existing value**: mirrors desktop's `[showClear]`/`onClear`. The mobile field
  button gets a small × affordance (separate tap target from the button itself) wired to the same
  `onDepartureClear()`/`onDestinationClear()`/`removeVia(stop.id)` handlers already used today.
- **z-index: `1000`.** Above every fixed chrome layer in the app (`header-nav` 200, `footer-nav`
  150, the wizard's own `.tpw-header` 110 — confirmed via a full-codebase `z-index` grep) but below
  the global `Drawer` service's stack (`DRAWER_BASE_Z = 4000`, `drawer.ts`), so a real page-level
  drawer would still render above this sheet in the unlikely case both were ever open at once. This
  sheet is **not** a `DrawerKey` — it's never linked to from outside `Step2Itinerary`, so it doesn't
  need the router-back-nav wiring every `DrawerKey` entry requires in `drawer-host.ts`; a local
  component signal is the right-sized abstraction (same reasoning `ConnectionLegPicker` itself
  already follows — it's a plain `@Input`/`@Output` component, only its page-level *wrapper*,
  `ConnectionsDrawer`, is a `DrawerKey`).
- **Prefill on reopen**: opening the sheet for a field that already has a value seeds the sheet's
  query input with that value's `name` (so the user immediately sees what's currently picked and
  can either retype to search or just close), matching desktop's existing display behavior.
- **Minimum query length**: 3 characters, same gate as desktop's `search()`.

## Frontend

### `frontend/src/app/features/trip-planner/step2-itinerary/location-search-sheet/location-search-sheet.ts` (new)

- Standalone component, `app-location-search-sheet`.
- Inputs: `tripType: 'road' | 'rail'`, `initialValue?: string` (prefill).
- Output: `selected = new EventEmitter<LocationSearchResult>()`, `closed = new EventEmitter<void>()`.
- Own signals: `query = signal('')`, `results = signal<LocationSearchResult[]>([])`,
  `loading = signal(false)`.
- `ngOnInit`/constructor: seeds `query` from `initialValue`; a `Subject<string>` fed by the
  input's `(ngModelChange)`, piped through `debounceTime(300)`, `distinctUntilChanged()`,
  `filter(q => q.trim().length >= 3)`, `tap(() => loading.set(true))`,
  `switchMap(q => transportSvc.searchLocations(q, tripType))`, writing into `results`/`loading`.
  Query text under 3 characters clears `results` immediately (no API call), same as desktop.
- `pick(result)`: emits `selected`, does not itself close — the parent (`Step2Itinerary`) closes
  by clearing `mobilePickerTarget` in its `onMobilePicked()` handler, keeping "what closes the
  sheet" in one place.
- `close()`: emits `closed`.
- Injects `TransportService` directly (`DestroyRef` + `takeUntilDestroyed` for the debounce
  subscription, matching the pattern already used throughout `step2-itinerary.ts`).

### `frontend/src/app/features/trip-planner/step2-itinerary/location-search-sheet/location-search-sheet.html` (new)

- `.lss-overlay` (fixed, `inset: 0`, `z-index: 1000`) containing:
  - `.lss-header`: back-chevron button (calls `close()`) + `{{ 'trip.planner.step2.searchTitle' | translate }}`.
  - `.lss-input-row`: single `<input>` (not `p-autoComplete` — plain native input), `#lssInput`
    with `[ngModel]="query()"` / `(ngModelChange)`, `[placeholder]="'trip.planner.step2.stop' | translate"`
    (reuses the existing placeholder key desktop already uses), `autofocus` so the on-screen
    keyboard opens immediately.
  - `.lss-results`: `@for (r of results(); track r.externalId) { <button class="lss-result" (click)="pick(r)">{{ r.name }}</button> }`,
    with a `@if (loading())` "Searching…" state and an `@if (!loading() && query().length >= 3 && results().length === 0)`
    "No results" state (both new i18n keys, see below).

### `frontend/src/app/features/trip-planner/step2-itinerary/location-search-sheet/location-search-sheet.css` (new)

- Full-screen fixed positioning, `background: var(--color-white)`, header row styled to match the
  wizard's own header conventions (`.tpw-header` in `trip-planner-wizard.css`) for visual
  continuity, results list as simple stacked rows (border-bottom dividers, no card chrome —
  matches the density of a typeahead list, not `.s2-card`).

### `frontend/src/app/features/trip-planner/step2-itinerary/step2-itinerary.ts`

- New signal `mobilePickerTarget = signal<'departure' | 'destination' | 'add' | { via: string } | null>(null)`.
- New `openMobilePicker(target)` / `closeMobilePicker()`.
- New `onMobilePicked(result: LocationSearchResult)`: switches on `mobilePickerTarget()` and calls
  the existing `applyDeparture`/`applyDestination`/`applyAddStop(result)` or
  `applyVia(result, viaStopById(target.via))`, then `closeMobilePicker()`.
- `startAddStop()`: unchanged for desktop; mobile's "+ Add stop" button (see template) calls
  `openMobilePicker('add')` directly instead.
- A small `mobilePickerInitialValue = computed(...)` resolving the right current name (departure
  name / destination name / via stop's name / `''` for add) to pass as the sheet's `initialValue`.

### `frontend/src/app/features/trip-planner/step2-itinerary/step2-itinerary.html`

- Each of the four field slots gains a sibling mobile block, e.g. for departure:
  ```html
  <p-autoComplete #depAuto class="s2-input s2-input--desktop" ... />
  <button type="button" class="s2-mobile-field" (click)="openMobilePicker('departure')">
    <span>{{ departure()?.name || ('trip.planner.step2.stop' | translate) }}</span>
    @if (departure()) {
      <span class="s2-mobile-clear" (click)="onDepartureClear(); $event.stopPropagation()">
        <i class="fa-light fa-xmark"></i>
      </span>
    }
  </button>
  ```
  mirrored for destination, each via stop (clear → `removeVia(stop.id)`), and the add-stop button
  (mobile: `(click)="openMobilePicker('add')"` directly, no `addingStop`-gated inline field).
- Once, after the whole via-list/destination/add-stop block:
  ```html
  @if (mobilePickerTarget(); as target) {
    <app-location-search-sheet
      [tripType]="type()"
      [initialValue]="mobilePickerInitialValue()"
      (selected)="onMobilePicked($event)"
      (closed)="closeMobilePicker()" />
  }
  ```

### `frontend/src/app/features/trip-planner/step2-itinerary/step2-itinerary.css`

- `.s2-input--desktop { }` — no new rule needed beyond the media query below; kept as a class hook.
- New `@media (max-width: 767px) { .s2-input--desktop { display: none; } }` and the inverse
  `.s2-mobile-field { display: none; } @media (max-width: 767px) { .s2-mobile-field { display: flex; ... } }`
  — same breakpoint as `drawer-host.css`.
- `.s2-mobile-field` styled to visually match `.s2-input`'s rendered `p-autocomplete` (same
  border/padding/font-size/radius as the existing `::ng-deep .s2-input .p-autocomplete-input`
  rule) so there's no visual jump between the mobile button and the desktop input it replaces.

## i18n — `trip.planner.step2.*`

New keys, en/de/fr/it in the same pass ([[feedback_i18n_translate_all_locales]]):

- `searchTitle`: "Search location" — sheet header.
- `searching`: "Searching…" — loading state.
- `noResults`: "No results found" — empty state.
- `clearSelection`: "Clear selection" — aria-label for the mobile field's × button (departure/destination only; via stops keep using the existing top-level `trip.planner.removeStop`, since clearing a via stop removes the whole row, not just the value).

`trip.planner.step2.stop` is reused as-is for both the mobile field's empty-state label and the sheet's input placeholder — no new key needed there.

## Open questions (not blocking, flag for later)

- Should the sheet show a short list of "recent"/"popular" locations before the user types
  anything (empty query state), or stay blank until 3+ characters like desktop? Leaning toward
  matching desktop for this phase — no new backend capability needed — but worth a product call.
- Tablet-width behavior (768-1024px, portrait) isn't explicitly considered — the 767px breakpoint
  puts it on the desktop/inline path by default; flag if that turns out wrong once tested on a
  real tablet.
- Should closing the sheet via the browser/Android back gesture be intercepted (so back closes the
  sheet instead of navigating away from the wizard)? Not handled in this phase since the sheet
  isn't a routed `DrawerKey`; worth checking real device behavior during UAT.

## References

- @frontend/src/app/features/trip-planner/step2-itinerary/step2-itinerary.ts
- @frontend/src/app/features/trip-planner/step2-itinerary/step2-itinerary.html
- @frontend/src/app/features/trip-planner/step2-itinerary/step2-itinerary.css
- @frontend/src/app/features/trip-planner/step2-itinerary/connection-leg-picker/connection-leg-picker.ts (precedent: plain `@Input`/`@Output` component, not a `DrawerKey`)
- @frontend/src/app/shared/services/drawer.ts (`DRAWER_BASE_Z = 4000`, confirmed this sheet doesn't need to be a `DrawerKey`)
- @frontend/src/app/shared/services/transport.ts (`searchLocations()`, reused directly)
- @frontend/src/app/shared/drawer-host/drawer-host.css (`max-width: 767px` breakpoint precedent)
- @context/current-feature.md (2026-07-28 Trip Planner Page Redesign entry — the `appendTo="body"`/`forceSelection` focus-steal bug this phase deliberately avoids repeating)
