# Explore Trips

## Goal

Turn the current `ExploreTrips` stub (`features/explore-trips/`, currently just a page-title `<h1>`)
into a real public trip-browsing feature: users can mark a saved trip public/private and stay
anonymous when public, write a review of their own trip, and everyone (logged in or not) can browse
public trips in an infinite-scroll grid of flip cards, filterable by trip type / creation order /
distance / likes, with a front face (map + summary) and a back face (timeline of destinations +
activities).

Six requirements from the brief, mapped onto the phases below:

1. Public/private + anonymous toggle when saving a trip → **Phase A**.
2. Add a review to your own trip; "Reviews written" stat on the profile → **Phase A**.
3. Review as an expand/collapse section on the profile's saved-trip card, collapsed by default →
   **Phase A**.
4. `/explore-trips` shows all public trips, newest first, 50 at a time, infinite scroll → **Phase C**.
5. Filter bottom-drawer: trip type, created order, distance, most likes → **Phase C**.
6. Flip trip cards (map summary front / timeline back) → **Phase D**.

Likes (needed for #5's "Most Likes" filter and shown on the card front) and the public trips API sit
in their own phase (**Phase B**) since both #4 and #6 depend on them existing first.

## Current state (verified against the code, not assumed)

- `models/trip.ts` / `backend/src/models/Trip.js`: no `isPublic`, `anonymous`, `review`, `likes`, or
  distance field of any kind. Only `routeCoordinates` (raw `[lon,lat][]`) exists — no distance is
  computed or stored anywhere today. **Answers the "km/mi" question from the brief: this needs to be
  added, not surfaced from existing data.**
- `backend/src/routes/trips.js`: single router, `router.use(protect)` gates every route — no public,
  unauthenticated read path exists.
- `backend/src/middleware/auth.js`: only a hard `protect` (401s with no token). No optional-auth
  variant that decodes a token if present but doesn't require one — needed for Phase B's `likedByMe`.
- `frontend/src/app/features/explore-trips/explore-trips.ts` / `.html`: stub, renders only a
  translated `<h1>`. Nav links already point here (`menu-nav.html`, `footer-nav.html`,
  `nav.exploreTrips` i18n key) and SEO is already wired (`seo.exploreTrips.*`, `RenderMode.Server` in
  `app.routes.server.ts`) — routing/SEO plumbing needs no changes.
- `features/auth/profile/profile.ts`: `stats().reviewsWritten` is hardcoded `7`; `savedTrips` cards
  (`profile.html` `.trips-grid` / `.trip-card`) show name/type/stops/date/view/delete only, no review
  UI at all.
- `shared/services/drawer.ts`: stack-based named-drawer service; every `DrawerKey` is rendered as its
  own `<p-drawer position="left|right">` block in `drawer-host.html`. No `position="bottom"` drawer
  exists yet, but PrimeNG's `p-drawer` supports it directly — no new mechanism needed, just a new key
  + block. (Per [[feedback_drawer_pattern]]: plain open/close, no collapse-in-place behavior for this
  one — it's a filter sheet, not a map-reveal drawer.)
- PrimeNG `21.1.6` already ships `card`, `selectbutton`, `slider`, `timeline`, `toggleswitch` (checked
  `node_modules/primeng/types/`) — no new dependency needed for any control the brief asks for.
  `ToggleSwitch` is already used once (`profile.ts`'s `emailUpdates`).
- `shared/map/map.ts` (`MapComponent`) already renders a trip route + numbered stop markers via
  `[tripRoute]`/`[tripType]`/`[tripStopPoints]` inputs, and arbitrary `[markers]` with
  `clickable`/non-clickable per marker — reusable as-is for the card-front mini map with activity
  markers, no `MapComponent` changes needed.
- `shared/utils/date-range.ts`'s `stopDayRanges()`/`stopDayOptions()` take a plain `TripStop[]`/
  `PlannedTrip` — reusable directly against a fetched `SavedTrip`/`PublicTrip` for the timeline back
  face, no duplication needed.

## Confirmed decisions

- Review is written/edited **only** from Profile → Saved Trips (not at Step 5 Save time) — it's a
  post-trip "how did it go" note, not part of the save flow.
- Likes: toggle, one per logged-in user, stored as `likes: [ObjectId]` on `Trip` so a like can be
  undone and can't be spammed; logged-out visitors can see counts but must log in to like.
- The profile's third stat tile (icon `fa-thumbs-up`, currently hardcoded `34` under the label
  "Reviews liked") is **redefined**, not left alone: it now means the total number of likes received
  across all trips the user has created and made public — `sum(trip.likes.length)` over their own
  `savedTrips`, not "reviews this user has liked" (nothing in this feature lets a user like a
  *review* independently of liking the trip it's attached to, so the old label never had a real
  mechanism behind it anyway). Label text changes from "Reviews liked" to "Likes received"
  (en/de/fr/it) to match. Each trip card in Profile's Saved Trips grid also gains its own
  per-trip like-count badge — explicit incentive for the user to make trips public, per the intent
  behind adding this.
- `distanceKm` is computed server-side from `routeCoordinates` and **persisted** on the `Trip` at
  create/update time (not recomputed per-card client-side) — needed so Explore Trips can filter/sort
  by distance without walking every trip's full coordinate array on every request.
- Phased: this master spec covers the full data model and all four phases; each phase gets its own
  branch off `main`. Once a phase starts implementation, its section here gets trimmed to a pointer
  and the detail moves to `context/features/explore-trips-<phase>-spec.md`, same convention as the
  trip-planner rebuild (see `[[project_trip_planner]]`).

## Assumptions flagged for review (reasonable calls made to keep this spec concrete — flag if wrong)

1. **Anonymous only matters when public.** The toggle order in Step 5 is: "Make trip public" first;
   "Stay anonymous" only shown once public is on (irrelevant, and hidden, while private). Anonymous
   defaults `true` the moment public is switched on.
2. **"Most Likes" is a sort-key toggle, not an independent filter axis.** The brief lists "Created
   order: Descending/Ascending" and "Most Likes" as separate lines but doesn't say how they combine.
   Implemented as: a "Sort by likes" switch that swaps the sort key from `createdAt` to `likes`; the
   existing Descending/Ascending select-buttons keep controlling direction either way (Descending +
   sort-by-likes = most-liked-first). Avoids a second, redundant direction control.
3. **Distance slider bounds are fixed at 0–1000 km**, not fetched dynamically from real data min/max —
   Switzerland-scale road/rail trips won't exceed this, and it avoids a second network round-trip
   just to size a slider. Revisit if real usage proves otherwise.
4. **Review is a single free-text field per trip** (the creator's own account of their own trip), not
   a multi-user review/rating system — matches "add a review to **their** trip" in the brief, and
   keeps `Trip` as the only new collection touched (no separate `Review` model).
5. Distance is stored in km; miles are derived at display time (`km * 0.621371`), never stored
   separately.
6. The "Likes received" stat and per-trip badges count likes regardless of a trip's *current*
   `isPublic` value (sum of `likes.length` as stored, not re-filtered by `isPublic` at read time) —
   likes only ever accrue on a trip while it's public in the first place (Phase B's `toggleLike`
   rejects likes on a non-public trip), so this is a historical total, not a live "currently public
   trips only" count. If the user later flips a well-liked trip back to private, those likes still
   count toward their profile stat. Flagged since "made public" in the request could also be read as
   a live filter — this reads more like an achievement/incentive stat, which fits the stated goal of
   encouraging users to make trips public.
7. Creator name/country on public cards is resolved via `Trip.user` populate on every list fetch
   (no denormalized copy on `Trip`) — fine at current scale; flagged as a future optimization if
   Explore Trips traffic grows large enough to matter.

## Shared data model (all phases build on this)

### Backend — `backend/src/models/Trip.js`

```js
const TripSchema = new mongoose.Schema({
    // ...existing fields unchanged...
    isPublic:   { type: Boolean, default: false },
    anonymous:  { type: Boolean, default: true },
    review:     { type: String, default: '', trim: true },
    likes:      { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    distanceKm: { type: Number, default: 0 },
});
```

### Backend — `backend/src/utils/geo.js` (new)

```js
const EARTH_RADIUS_KM = 6371;

function haversineKm([lon1, lat1], [lon2, lat2]) {
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function routeDistanceKm(coords) {
    if (!coords || coords.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < coords.length - 1; i++) total += haversineKm(coords[i], coords[i + 1]);
    return Math.round(total * 10) / 10;
}
```

Called from `createTrip`/`updateTrip` (Phase A) — `distanceKm: routeDistanceKm(routeCoordinates)`,
never trusted from the request body.

### Frontend — `models/trip.ts`

```ts
export interface PlannedTrip {
  // ...existing fields unchanged...
  isPublic?: boolean;
  anonymous?: boolean;   // defaults true when isPublic is first switched on
  review?: string;
  distanceKm?: number;   // server-computed, present once saved
}

export interface SavedTrip extends PlannedTrip {
  _id?: string;
  createdAt?: string;
  likes?: string[];      // user ids, present once saved
}

// Phase B+: shape returned by GET /trips/public — a SavedTrip plus the derived
// fields the list view needs and privacy-filtered creator info.
export interface PublicTrip extends Omit<SavedTrip, 'likes'> {
  creatorName: string | null;    // null when anonymous
  creatorCountry: string | null; // null when anonymous
  likeCount: number;
  likedByMe: boolean;
}
```

### `shared/utils/distance.ts` (new)

```ts
export function kmToMi(km: number): number {
  return km * 0.621371;
}

/** "150 km / 93 mi" */
export function formatDistance(km: number): string {
  return `${Math.round(km)} km / ${Math.round(kmToMi(km))} mi`;
}
```

## Phase A — Save-trip privacy/review + profile review UI

**Branch:** `feature/explore-trips-privacy-review`

### Backend

- `Trip.js`: add `isPublic`/`anonymous`/`review`/`likes`/`distanceKm` (see model above).
- `backend/src/utils/geo.js`: new file (see above).
- `controllers/trips.js`:
  - `createTrip`: destructure `isPublic`, `anonymous` from `req.body` (default `false`/`true` if
    absent); compute `distanceKm: routeDistanceKm(routeCoordinates ?? [])`; `review`/`likes` left at
    schema defaults (not settable at create time).
  - `updateTrip`: currently does a blanket `findByIdAndUpdate(req.params.id, req.body, ...)`. Needs
    to recompute `distanceKm` when `routeCoordinates` is present in the update body (same helper),
    and must **not** let `likes` be set directly through this endpoint (strip it from the body before
    the update, or explicitly whitelist fields) — likes only change through Phase B's dedicated
    like-toggle endpoint. `review` update flows through here as a normal field (Phase A's Profile UI
    calls `PUT /trips/:id` with `{ review }`).

### Frontend — Step 5 Save

- `models/trip.ts`: add fields (above).
- `step5-save.ts`: two new signals, `isPublic = signal(this.plannerSvc.snapshot.isPublic ?? false)`
  and `anonymous = signal(this.plannerSvc.snapshot.anonymous ?? true)`; both included in the `save()`
  payload alongside `name`.
- `step5-save.html`: new block after the name input —
  ```html
  <div class="s5-visibility-field">
    <label>{{ 'trip.planner.step5.makePublic' | translate }}</label>
    <p-toggleswitch [(ngModel)]="isPublic" />
  </div>
  @if (isPublic()) {
    <div class="s5-visibility-field">
      <label>{{ 'trip.planner.step5.stayAnonymous' | translate }}</label>
      <p-toggleswitch [(ngModel)]="anonymous" />
    </div>
  }
  ```
- i18n (`trip.planner.step5` namespace, en/de/fr/it): `makePublic`, `makePublicHint` ("Other
  travelers will be able to see this trip on Explore Trips"), `stayAnonymous`, `stayAnonymousHint`
  ("Your name and country won't be shown").

### Frontend — Profile Saved Trips: like badge + review

- `profile.html`'s `.trip-card-header` (name + type `p-tag`) gains a like-count badge next to the
  type tag — `<span class="trip-card-likes"><i class="fa-solid fa-thumbs-up"></i>{{ trip.likes?.length ?? 0 }}</span>`.
  Shown on every card (private trips just read `0`, which is itself the nudge toward making a trip
  public — no likes possible while private). Reads `0` for everyone until Phase B's like-toggle
  ships; the field/UI is wired now since it needs no data this phase doesn't already have available
  (`likes` is on the `Trip` schema as of this phase, `getTrips` already returns it with no endpoint
  changes needed).
- `.trip-card` (inside `.trips-grid`) also gains a collapsible review section, collapsed by
  default, below the existing `trip-card-actions` row:
  ```html
  <button class="trip-card-review-toggle" type="button" (click)="toggleReview(trip)">
    <i class="fa-light" [class.fa-chevron-down]="!isReviewOpen(trip)" [class.fa-chevron-up]="isReviewOpen(trip)"></i>
    {{ 'profile.savedTrips.review' | translate }}
  </button>
  @if (isReviewOpen(trip)) {
    <div class="trip-card-review-body">
      @if (editingReviewId() === trip._id) {
        <textarea class="trip-card-review-input" [(ngModel)]="reviewDraft" rows="3"
                  [placeholder]="'profile.savedTrips.reviewPlaceholder' | translate"></textarea>
        <p-button [label]="'profile.savedTrips.saveReview' | translate" size="small" (onClick)="saveReview(trip)" />
      } @else {
        <p class="trip-card-review-text">{{ trip.review || ('profile.savedTrips.noReview' | translate) }}</p>
        <p-button [label]="'profile.savedTrips.editReview' | translate" [text]="true" size="small" (onClick)="startEditReview(trip)" />
      }
    </div>
  }
  ```
- `profile.ts`: `openReviewIds = signal<Set<string>>(new Set())` + `toggleReview()`/`isReviewOpen()`;
  `editingReviewId = signal<string | null>(null)` + `reviewDraft = signal('')`;
  `startEditReview(trip)` seeds the draft; `saveReview(trip)` calls
  `tripsSvc.updateTrip(trip._id!, { review: this.reviewDraft() })`, patches the local `savedTrips`
  signal on success, clears `editingReviewId`, and recomputes `stats().reviewsWritten`.
- `stats` computation rewritten off the real `savedTrips` signal instead of two hardcoded numbers:
  ```ts
  this.tripsSvc.getTrips().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(trips => {
    this.savedTrips.set(trips);
    this.stats.set({
      savedTrips: trips.length,
      reviewsWritten: trips.filter(t => t.review?.trim()).length,
      likesReceived: trips.reduce((sum, t) => sum + (t.likes?.length ?? 0), 0),
    });
  });
  ```
  (`reviewsLiked` renamed `likesReceived` — see "Confirmed decisions" for what changed and why.
  `saveReview()`'s post-save patch recomputes `reviewsWritten` the same way, off the updated
  `savedTrips` list, rather than a one-off increment.)
- `profile.html`'s third stat tile keeps its `fa-thumbs-up` icon/binding, just now backed by
  `stats().likesReceived` instead of `stats().reviewsLiked`.
- i18n (`profile.savedTrips` namespace): `review`, `reviewPlaceholder`, `noReview`, `editReview`,
  `saveReview`. `profile.stats.likes` value changes "Reviews liked" → "Likes received" (en/de/fr/it,
  key unchanged).

### Verification plan

- `tsc --noEmit` (frontend), `node --check` (backend controllers/models).
- Live: save a trip with public+anonymous defaults untouched → confirm `isPublic:false` persisted.
  Toggle public on, save → confirm `isPublic:true`, `anonymous:true`. Toggle anonymous off, save →
  confirm `anonymous:false`. Edit an existing saved trip's route (Step 2) and re-save → confirm
  `distanceKm` recomputes.
- Live: write a review on a saved trip from Profile, reload the page → review persists and
  `reviewsWritten` count updates. Confirm the review section starts collapsed on page load.
- Live: confirm every saved-trip card shows a like badge reading `0` (no way to generate a real like
  until Phase B ships the like-toggle endpoint) and that `stats().likesReceived` is `0` for an
  account with no likes yet — real non-zero verification happens once Phase B/D are live and a trip
  can actually be liked; re-check both then.

## Phase B — Public trips API + likes

**Branch:** `feature/explore-trips-public-api` (spec split out to
`context/features/explore-trips-public-api-spec.md` when this phase starts)

### Backend

- `backend/src/middleware/auth.js`: new `optionalAuth` — same token extraction as `protect`, but on
  missing/invalid token it just calls `next()` with `req.user` left `undefined` instead of 401ing.
  Needed so `getPublicTrips` can compute `likedByMe` for a logged-in caller while staying reachable
  logged-out.
- `backend/src/routes/trips.js`: drop the blanket `router.use(protect)`; apply `protect`/
  `optionalAuth` per route instead:
  ```js
  router.get('/public', optionalAuth, getPublicTrips);   // must be registered before '/:id'-shaped routes
  router.post('/:id/like', protect, toggleLike);
  router.route('/').get(protect, getTrips).post(protect, createTrip);
  router.route('/:id').put(protect, updateTrip).delete(protect, deleteTrip);
  ```
- `controllers/trips.js`:
  - `getPublicTrips(req, res)`: query params `skip` (default `0`), `limit` (default `50`, capped at
    `50`), `type` (`'all'|'road'|'rail'`, default `'all'`), `sort` (`'createdAt'|'likes'`, default
    `'createdAt'`), `order` (`'asc'|'desc'`, default `'desc'`), `minDistance`/`maxDistance` (km,
    optional). Builds a Mongo filter `{ isPublic: true }` (+ `type` if not `'all'`, +
    `distanceKm: { $gte, $lte }` if bounds given), sorts by `{ [sortField]: order === 'asc' ? 1 : -1 }`
    where `sortField` is `createdAt` or a computed `likesCount` (Mongo `$size` aggregation needed
    since `sort` can't order by array length directly — use `.aggregate()` with
    `$addFields: { likeCount: { $size: '$likes' } }` then `$sort`/`$skip`/`$limit`, or sort by
    `createdAt` only and note `likes` sort as an aggregation pipeline swap-in), populates `user`
    (`firstName lastName country`), and shapes the response per trip: if `trip.anonymous`,
    `creatorName`/`creatorCountry` are `null`; otherwise `${user.firstName} ${user.lastName}` /
    `user.country`. `likeCount = trip.likes.length`; `likedByMe = req.user ? trip.likes.includes(req.user.id) : false`.
  - `toggleLike(req, res, next)`: find trip by `req.params.id`, 404 if missing or not `isPublic`
    (can't like a private trip even if you know the id); toggle `req.user.id` in/out of `likes`,
    save, return `{ likeCount, liked }`.

### Frontend

- `models/trip.ts`: `PublicTrip` (above).
- `shared/services/explore-trips.ts` (new): `getPublicTrips(params): Observable<{ trips: PublicTrip[]; hasMore: boolean }>`
  wraps `GET /trips/public`; `toggleLike(id): Observable<{ likeCount: number; liked: boolean }>` wraps
  `POST /trips/:id/like`.

### Verification plan

- `node --check` on the new/changed backend files; manual `curl` (no `Authorization` header) against
  `GET /api/v1/trips/public` on a mix of public/private/anonymous seed trips — confirm private trips
  never appear, anonymous trips have `creatorName: null`, non-anonymous ones show real name/country.
- `curl` with a valid `Authorization` header, like a trip via `POST /trips/:id/like`, re-fetch
  `/public` → confirm `likedByMe: true` and `likeCount` incremented; call the like endpoint again →
  confirm it un-likes (toggle, not increment-only).
- Confirm `/public` is reachable with zero `Authorization` header at all (this is the "browse without
  an account" requirement from #4) and confirm `/:id`-based mutating routes still 401 without one.

## Phase C — Explore Trips page: grid, infinite scroll, filter drawer

**Branch:** `feature/explore-trips-page` (spec split out to
`context/features/explore-trips-page-spec.md` when this phase starts)

### Frontend

- `explore-trips.ts` rewritten from the current stub: signals for `trips: PublicTrip[]`, `skip`,
  `loading`, `hasMore`, plus a small local `ExploreTripsFilterState` (type/sort/order/distance range)
  read by both this component and the new filter-drawer component below — either a tiny injectable
  service (mirrors how `Drawer`/`TripPlannerService` centralize cross-component state elsewhere in
  this app) or signals owned directly on `ExploreTrips` and passed into the filter drawer via
  `Drawer.setPayload`/`getPayload` (existing mechanism, no new service needed) — pick whichever reads
  cleaner once the filter component is being written; both are consistent with existing patterns.
- Infinite scroll: an `IntersectionObserver` on a sentinel element at the end of the grid triggers
  `fetchNextBatch()` (`skip += 50`) when it enters the viewport, same shape as the existing
  `IntersectionObserver` usage in `all-attractions.ts` — reuse that pattern rather than inventing a
  new one.
- Filter icon button in `explore-trips.html`'s header opens a new `Drawer` key.
- `shared/services/drawer.ts`: add `'explore-trips-filter'` to the `DrawerKey` union.
- `drawer-host.html`: new `<p-drawer position="bottom" ...>` block (first `position="bottom"` drawer
  in the app — everything else so far is `left`/`right`) hosting the new filter component.
- New `features/explore-trips/explore-trips-filter/` component:
  - `p-selectbutton` — trip type, options `all`/`road`/`rail` (i18n-labeled "All"/"Road trips"/"Rail
    trips").
  - `p-selectbutton` — created order, `desc`/`asc` ("Descending"/"Ascending") — see Assumption #2 for
    how this interacts with the likes toggle.
  - toggle — "Sort by most liked" (see Assumption #2).
  - `p-slider` — distance, range mode, `[min]="0" [max]="1000"` (see Assumption #3), km.
  - Apply/Reset buttons; Apply pushes the filter state back and closes the drawer; `ExploreTrips`
    resets `skip` to `0` and refetches on any filter change.

### Verification plan

- `tsc --noEmit`; live: seed >50 public trips, confirm the first 50 load newest-first, scrolling to
  the bottom fetches the next 50 with no duplicate/missing rows.
- Live: each filter control (type, order, distance range, most-liked) independently changes the
  result set correctly; combining them (e.g. Road trips + most-liked + a narrow distance band)
  produces the intersection, not just the last-applied filter.
- Confirm the filter drawer opens from the bottom (not left/right like every other drawer in the app)
  and behaves like every other drawer otherwise — plain open/close, no collapse-to-map behavior (per
  `[[feedback_drawer_pattern]]`, this isn't a map-reveal drawer so that mechanism doesn't apply here).

## Phase D — Flip trip card (map front / timeline back)

**Branch:** `feature/explore-trips-card` (spec split out to
`context/features/explore-trips-card-spec.md` when this phase starts)

### Frontend

- New `features/explore-trips/trip-card/` component, `@Input trip: PublicTrip`:
  - `flipped = signal(false)`; both faces render a
    `<button (click)="flipped.set(!flipped())"><i class="fa-solid fa-arrow-rotate-right"></i></button>`
    per the brief's exact icon.
  - CSS: `.trip-card-flip-inner { transform-style: preserve-3d; transition: transform .6s; }` +
    `.flipped { transform: rotateY(180deg); }`, both faces `position: absolute; backface-visibility: hidden;`,
    back face pre-rotated `rotateY(180deg)` — standard CSS flip-card pattern, no animation library
    needed.
  - **Front face:** trip name; creator — `trip.creatorName` + `trip.creatorCountry`, or the
    `'exploreTrips.anonymous'` i18n string when `creatorName === null`; type badge (reuse the
    `p-tag` pattern from `profile.html`'s saved-trip card); duration (`tripDayCount`-derived, same
    util as Step 5); `trip.stops.length` destinations; `trip.activities.length` activities; review —
    expandable, collapsed by default, **read-only** here (no edit — editing only happens on the
    owner's own Profile page per the Phase A decision); an embedded `<app-map>` with
    `[tripRoute]="trip.routeCoordinates" [tripType]="trip.type" [markers]="activityMarkers()"` where
    `activityMarkers()` maps `trip.activities` to `MapMarker[]` with **`clickable: false`** (per the
    brief: "no click event on the activities") — `MapComponent` already supports non-clickable
    markers, no change needed there; a like button (`fa-thumbs-up`, filled when `trip.likedByMe`)
    calling `exploreTripsSvc.toggleLike(trip._id)`, disabled/redirects to the auth drawer when
    logged out (same `Drawer.open('auth')` pattern `step5-save.ts` already uses); distance —
    `formatDistance(trip.distanceKm)` (answers the brief's km/mi question).
  - **Back face:** trip name repeated; a new `<app-trip-timeline [trip]="trip">`.
- New `features/explore-trips/trip-timeline/` component wrapping PrimeNG `p-timeline`, `@Input trip: PublicTrip`:
  - Builds one timeline entry per stop using `stopDayRanges(trip.stops)` for the date/day label
    (reused directly — no duplicate day-numbering logic) and `stopDayOptions`-style date formatting
    when `trip.dateMode === 'dates'`.
  - Each entry's `p-timeline` content template lists that stop's activities (`trip.activities.filter(a => a.stopId === stop.id)`), grouped by kind the same way `step4-summary.html` already groups them (reuse the `ACTIVITY_GROUPS` shape/icons from `step4-summary.ts` for visual consistency rather than inventing new icons).
  - Matches `explore_trips2.png`'s layout: destination name + date on the left of the timeline axis,
    a card (Transit / Activity list) on the right per stop.

### Verification plan

- `tsc --noEmit`; live: flip a card both directions, confirm the icon/button works identically on
  both faces and the animation doesn't clip/overflow the card bounds.
- Confirm the front-face map renders the route + activity markers and that clicking a marker does
  **nothing** (no popup navigation, no drawer open) — the brief is explicit that activities aren't
  clickable here, unlike every other `app-map` usage in the app.
- Confirm the back-face timeline's day labels match what Step 4's own timeline would show for the
  same trip data (cross-check against `stopDayRanges()` directly, not just visually) — this reuses
  the exact function Step 4 uses, so a mismatch would indicate a props/data-shape bug in this
  component, not the underlying algorithm.
- Confirm review expand/collapse defaults collapsed on every card on initial page load, and that
  expanding one card's review doesn't affect others' state.

## Out of scope (this spec)

- No rating/star system — review is free text only, matching Assumption #4.
- No comments/replies on other users' trips — liking is the only interaction besides viewing.
- No moderation/reporting flow for public trip content.
- No push/email notification when a trip gets liked.
- Hotel-selection feature (separately planned per `[[project_trip_planner]]`) is unrelated and
  untouched here.

## References

- @frontend/src/app/models/trip.ts
- @backend/src/models/Trip.js
- @backend/src/controllers/trips.js
- @backend/src/routes/trips.js
- @backend/src/middleware/auth.js
- @frontend/src/app/features/explore-trips/explore-trips.ts
- @frontend/src/app/features/auth/profile/profile.ts
- @frontend/src/app/features/auth/profile/profile.html
- @frontend/src/app/features/trip-planner/step5-save/step5-save.ts
- @frontend/src/app/features/trip-planner/step4-summary/step4-summary.ts (activity-grouping pattern
  to reuse in Phase D's timeline)
- @frontend/src/app/shared/services/drawer.ts
- @frontend/src/app/shared/drawer-host/drawer-host.html
- @frontend/src/app/shared/map/map.ts
- @frontend/src/app/shared/utils/date-range.ts
- @context/screenshots/explore_trips1.png (card front mockup)
- @context/screenshots/explore_trips2.png (card back / timeline mockup)
- `[[project_trip_planner]]`, `[[feedback_drawer_pattern]]`, `[[feedback_maplibre_markers]]`,
  `[[feedback_mockups_are_journey_not_design]]`, `[[feedback_i18n_translate_all_locales]]`
