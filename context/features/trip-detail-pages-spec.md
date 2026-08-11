# Public Trip Detail Pages (SEO)

## Goal

Give published/public trips their own crawlable, shareable, SEO-friendly URL —
`/{lang}/trips/:slug` — so a curated itinerary can rank and be linked to directly, instead of only
existing as a flip-card inside the `/explore-trips` grid or inside the client-only, unindexed
`/trip-planner/:id` builder view. This is the plumbing for a broader SEO play discussed with the
user: seed initial content by publishing a batch of hand-built itineraries under one curated
account ("ActivSwitzerland Travel Agent"), avoiding the cold-start problem of needing real users
before there's any content worth indexing.

## Current state (verified against the code, not assumed)

- `backend/src/models/Trip.js` / `frontend/src/app/models/trip.ts`: no `slug` field anywhere.
- `frontend/src/app/app.routes.server.ts:30`: `trip-planner/**` is explicitly
  `RenderMode.Client` — "Personal/authenticated content, not canonical — client-render only, no
  SSR/prerender spent here." Confirms this route was deliberately excluded from indexing and isn't
  reusable for a public content page; a new route is needed.
- `:lang/explore-trips` is `RenderMode.Server` (already SSR'd) — the pattern to match for the new
  route.
- `backend/src/routes/trips.js`: only `GET /trips/public` (list, paginated) and
  `POST /trips/:id/like` are public/`optionalAuth`. There is no single-trip public read endpoint —
  `PUT`/`DELETE /trips/:id` exist but are `protect`-gated and owner-only. A new endpoint is needed
  to fetch one trip for the detail page.
- `features/explore-trips/trip-card/trip-card.ts` (grep-confirmed): no `routerLink` anywhere. Cards
  are self-contained — front face (map + summary), back face (`trip-timeline`) via a CSS flip, no
  navigation to any standalone page. No single-trip page exists today; this is wholly new.
- `shell/destinations-layout/destinations-layout.ts` (lines ~255–295) is the established template
  for a real SSR content-detail page: route-param-driven fetch via `switchMap`, `catchError` →
  `null` + `seo.set({ noindex: true })` + `seo.setStructuredData(null)`, success path calls
  `seo.set()` + `seo.setStructuredData()`. Reused directly for the new component.
- `frontend/scripts/generate-sitemap.mjs`: enumerates destination ids by paging
  `GET /myswitzerland/destinations` at postbuild time and writes them into `sitemap.xml`. Same
  shape needed for trip slugs, paging the existing `GET /trips/public` instead.
- No admin/role concept exists on the `User` model. "ActivSwitzerland Travel Agent" will be a
  normal registered account publishing trips through the existing Step 5 Save "Make public" flow —
  no backend access-control work needed for that part.

## Confirmed decisions (from prior discussion)

1. **Slug is immutable once assigned, decoupled from `name`.** Generated once, never regenerated
   on a later rename — renaming updates the displayed title only. Rationale: regenerating on every
   edit breaks previously-shared/indexed URLs and undermines the SEO equity this feature exists to
   build.
2. **Slug generation triggers on the `isPublic` false→true transition only** — at `createTrip` if
   public from the start, or at `updateTrip` the first time it flips to public. Not regenerated on
   any subsequent save, including one that also changes `name`.
3. **Slug is shared across locales**, not translated per-locale — one path segment per trip
   regardless of the `/en|de|fr|it/` prefix. Matches `SeoService.setHreflang()`'s existing
   same-path/different-prefix assumption ([seo.ts:83-90](frontend/src/app/shared/services/seo.ts#L83-L90));
   translating slugs per locale would break that and multiply the dedup surface for no real gain.
4. **New standalone route `trips/:slug`, SSR (`RenderMode.Server`)** — separate from the
   client-only `trip-planner/:id` builder route, which stays exactly as-is.
5. **Draft/private trips never get a slug** — assignment is gated on `isPublic`, matching item 2.

## Assumptions flagged for review

1. **No manual slug editing / no redirect-on-rename in this pass.** The earlier edge-case
   discussion covered "admin explicitly changes a bad auto-generated slug, old slug 301s to the
   new one" — that's real but out of scope here to keep this spec shippable; flagged as a
   fast-follow once the base feature is live and an actual bad slug shows up in practice.
2. **Unpublishing (`isPublic` true→false) 404s the page**, not 410 Gone. Simpler for v1; 410 is
   arguably the more correct signal for "deliberately removed" vs "never existed" — flagged, not
   blocking.
3. **Duplicate-name handling folds a duration label into the slug before falling back to a numeric
   suffix** — `slugify(`${name} ${durationLabel}`)`, where `durationLabel` comes from the existing
   `tripDayCount()` util (already used by Step 5/timeline, not reimplemented). Only if that's still
   taken does a numeric suffix (`-2`, `-3`, …) get appended.
4. **Transliteration is a small explicit map for common Swiss/French/German diacritics** (ü, ö, ä,
   é, è, à, ô, â, ç, …) with a generic `normalize('NFKD')` + combining-mark-strip fallback for
   anything not in the map — covers the realistic input space (Swiss place names) without pulling
   in a full slug-library dependency.
5. **`trips/:slug` reuses `trip-card`'s constituent pieces** (map, summary header,
   `trip-timeline`) stacked in a single static layout — no flip interaction, since flipping only
   makes sense in a grid-browsing context, not a standalone landing page.

## Data model changes

### Backend — `backend/src/models/Trip.js`

```js
const TripSchema = new mongoose.Schema({
    // ...existing fields unchanged...
    slug: { type: String, unique: true, sparse: true, index: true },
});
```

`sparse` since only public trips ever get one; the DB-level `unique` index is a second line of
defense behind the application-level dedupe loop below.

### Backend — `backend/src/utils/slug.js` (new)

```js
const TRANSLITERATIONS = { ü: 'ue', ö: 'oe', ä: 'ae', é: 'e', è: 'e', à: 'a', â: 'a', ô: 'o', ç: 'c', /* ... */ };

export function slugify(text) {
    const lower = text.toLowerCase();
    const mapped = [...lower].map(ch => TRANSLITERATIONS[ch] ?? ch).join('');
    return mapped
        .normalize('NFKD').replace(/[̀-ͯ]/g, '')  // strip remaining diacritics
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
        .replace(/-+$/, '');
}

// isTaken: (slug) => Promise<boolean>, e.g. `slug => Trip.exists({ slug })`
export async function generateUniqueSlug(baseText, isTaken) {
    const base = slugify(baseText) || 'trip';
    let candidate = base;
    let n = 2;
    while (await isTaken(candidate)) {
        candidate = `${base}-${n++}`;
    }
    return candidate;
}
```

### Backend — `controllers/trips.js`

- `createTrip`: if `isPublic` is true, compute
  `slug: await generateUniqueSlug(`${name} ${tripDurationLabel(range, dateMode)}`, slug => Trip.exists({ slug }))`
  before `Trip.create()`. (`tripDurationLabel` — new small helper mirroring the frontend's
  `tripDayCount()` logic, since this needs to run server-side; see Assumption 3.)
- `updateTrip`: already fetches the existing `trip` first. Add: if `!trip.slug && updates.isPublic === true`,
  generate and set `updates.slug` the same way. Defensively strip any client-supplied `slug` from
  `updates` unconditionally first (same pattern already used for `likes` —
  [trips.js:46-47](backend/src/controllers/trips.js#L46-L47)) — slug is server-derived only, never
  client-settable, and must never be overwritten once a trip already has one.

### Backend — new endpoint `GET /trips/slug/:slug`

- `routes/trips.js`: `router.get('/slug/:slug', optionalAuth, getTripBySlug)` — registered before
  the `/:id`-shaped routes, same reason `/public` already is
  ([trips.js:7-9](backend/src/routes/trips.js#L7-L9)).
- `controllers/trips.js`: `getTripBySlug` — `Trip.findOne({ slug: req.params.slug, isPublic: true })`,
  404 via `ErrorResponse` if not found, else shape the response identically to one row of
  `getPublicTrips`'s existing map (anonymized creator info, `likeCount`, `likedByMe` — reuse that
  shaping logic rather than duplicating it, e.g. factor the per-trip shape out of `getPublicTrips`
  into a small shared helper both call).

### Frontend — `models/trip.ts`

```ts
export interface SavedTrip extends PlannedTrip {
  _id?: string;
  slug?: string;         // present once the trip has been public at least once
  createdAt?: string;
  likes?: string[];
}
```

(`PublicTrip` inherits it via `extends Omit<SavedTrip, 'likes'>` — no separate change needed.)

### Frontend — `shared/services/explore-trips.ts`

New method: `getTripBySlug(slug: string): Observable<PublicTrip>` wrapping
`GET /trips/slug/:slug`.

## Routing

- `app.routes.ts`: new child route under `MainLayout`, alongside `explore-trips` —
  ```ts
  {
    path: 'trips/:slug',
    loadComponent: () => import('./features/trip-detail/trip-detail').then(m => m.TripDetail),
  },
  ```
- `app.routes.server.ts`: `{ path: ':lang/trips/:slug', renderMode: RenderMode.Server }`, inserted
  next to the existing `explore-trips` line.

## New component — `features/trip-detail/trip-detail.ts`

Modeled directly on `destinations-layout.ts`'s fetch/SEO pattern:

- Route param (`slug`) driven `switchMap` → `exploreTripsSvc.getTripBySlug(slug)`.
- `catchError` → `trip.set(null)`, `seo.set({ title: notFoundLabel, description: notFoundLabel, noindex: true })`,
  `seo.setStructuredData(null)`.
- Success → `seo.set({ title: trip.name, description: <derived from review or stop names + duration>, image: <first activity image if any, else omit> })`,
  `seo.setStructuredData({ '@context': 'https://schema.org', '@type': 'TouristTrip', name: trip.name, ... })`.
- Template: map + summary header (name, creator/anonymous, type badge, duration, distance — same
  data `trip-card`'s front face already renders) followed by `<app-trip-timeline [trip]="trip()">`
  (existing component, reused as-is, no changes needed there). No flip control.
- 404/not-found state: simple message + link back to `/explore-trips`.

## Surfacing the new page

- `trip-card.html`: add a "View full itinerary" link (`routerLink` to `trips/:slug`) — only ever
  renders once a slug exists, which is always true for anything `getPublicTrips` returns once this
  ships (public ⇒ has a slug, per the transition rule above). Existing flip interaction is
  untouched; this is an additional affordance, not a replacement.

## Sitemap — `frontend/scripts/generate-sitemap.mjs`

- New `getTripSlugs()`, same shape as the existing `getDestinationIds()` but paging
  `GET /trips/public` (already paginated, `hasMore`-driven) instead of the MySwitzerland endpoint,
  collecting `slug` off each row.
- `buildSitemap()`: add `...tripSlugs.map(slug => ({ path: `/trips/${slug}`, priority: '0.6' }))`,
  same tier as destination-detail pages, no `lastmod` (no per-trip modification date tracked,
  same reasoning already applied to destinations — see that section's comment in the script).

## Out of scope

- Admin UI/role for the "Travel Agent" account — it publishes trips through the existing Step 5
  Save flow like any other user; no new access control.
- Manual slug editing / redirect-on-rename (Assumption 1) — fast-follow.
- Any content-generation tooling — this is the URL/page plumbing only. Writing the actual seed
  itineraries stays a manual, editorial task per the earlier discussion.

## Verification plan

- `node --check` (backend), `tsc --noEmit` (frontend).
- Create a trip public at creation → confirm `slug` is set, correctly formatted, and that creating
  a second trip with an identical name+duration gets a `-2` suffix.
- Flip an existing private trip to public via `updateTrip` → confirm `slug` appears; rename it in a
  later update → confirm `slug` does **not** change.
- `curl GET /trips/slug/:slug` logged out → 200 with privacy-shaped data for a real public trip;
  404 for a private trip's slug and for a nonexistent one.
- SSR: production build, run the built server locally, `curl` a real `/en/trips/:slug` page and
  confirm canonical/hreflang/`TouristTrip` JSON-LD are present in the raw HTML (not only after
  client hydration) — same verification style used for the destination-detail JSON-LD work.
- Confirm `trip-card`'s new "View full itinerary" link lands on the correct page and that the
  in-grid flip interaction is unaffected.
- Confirm `sitemap.xml` (postbuild output) includes an entry per public trip slug, one per locale.

## References

- @frontend/src/app/models/trip.ts
- @backend/src/models/Trip.js
- @backend/src/controllers/trips.js
- @backend/src/routes/trips.js
- @frontend/src/app/app.routes.ts
- @frontend/src/app/app.routes.server.ts
- @frontend/src/app/shell/destinations-layout/destinations-layout.ts (SSR detail-page pattern to
  reuse)
- @frontend/src/app/shared/services/seo.ts
- @frontend/src/app/features/explore-trips/trip-card/trip-card.ts
- @frontend/src/app/features/explore-trips/trip-timeline/trip-timeline.ts
- @frontend/src/app/shared/services/explore-trips.ts
- @frontend/scripts/generate-sitemap.mjs
- `context/features/explore-trips-spec.md` (data model / public-trips API this builds on)
- `context/features/seo-structured-data-lang-spec.md` (structured-data conventions)
