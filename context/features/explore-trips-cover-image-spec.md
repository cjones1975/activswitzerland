# Explore Trips — Cover Photo on Trip Cards

## Overview

`TripCard` (the Explore Trips grid) currently has no photo at all — just a text/map-thumbnail
card. This adds a cover photo pulled from the trip's own first activity, without introducing any
new per-render API calls or reviving the backend cache-and-serve *image-bytes* proxy that was
built, tested, and reverted in a past session — MySwitzerland's image CDN TLS-fingerprints and
blocks server-side automated fetches of the actual image bytes (confirmed across Node/axios and
curl, on Windows and inside the real Linux container; only real browsers get through). Only a URL
*string* is ever fetched server-side here — the same MySwitzerland attraction-lookup call this
backend already proxies elsewhere, no different in kind — and images still load directly from
MySwitzerland's CDN in the browser, exactly like `destination-vertical-list` already does.

## Current state (verified in code)

- `TripCard` (`features/explore-trips/trip-card/`) has no image today — front face is
  name/tag/creator line/stats/map-thumbnail/review-toggle/footer.
- `TripStop` (`models/trip.ts`, `models/Trip.js`) is a free-text geo-point — no MySwitzerland
  destination id, so stops can't be used to look up a real photo.
- `TripActivitySelection`/`TripActivitySchema` *does* carry a real MySwitzerland id: `refId`, used
  today by `attractionsService.getAttraction(refId, lang)` (`trip-card.ts`'s
  `onActivityMarkerClick`) — but only for `kind === 'attraction'`. `kind === 'hike'`/`'bike'`
  activities resolve against SchweizMobil route data, which carries no photo field at all
  (`backend/src/utils/schweizMobilRoutes.js`).
- `activities` is a plain append-only array (`shared/services/trip-planner.ts`'s `addActivity`/
  `removeActivity`) — never reordered or sorted — so `activities[0]` is reliably "the first one
  the user added" (whatever currently remains at index 0, if any were later removed).
- `TripCard` is only ever rendered for public trips (`explore-trips.html`) — the private "My
  Trips" list on `profile.ts` doesn't use it.
- `createTrip`/`updateTrip` (`backend/src/controllers/trips.js`) already recompute one
  server-derived field on every relevant save — `distanceKm`, whenever `routeCoordinates` is
  present — and gate translation/`reviewLang` work on `isPublic`/`effectiveIsPublic`. The one and
  only place a trip's `isPublic` flips true is `step5-save.ts`, which always submits the *full*
  planner snapshot (including `activities`), not a partial patch — confirmed by reading its
  `payload` construction and the two other `updateTrip(...)` call sites (`profile.ts`'s
  `saveReview`/`saveName`, both narrow field-only patches that never touch `isPublic`).
- `getAttraction` (`backend/src/controllers/myswitzerland.js`) is only exported as an Express
  route handler (`asyncHandler`), not reusable as a plain function — needs a small extraction to
  call from `trips.js`.

## Requirements

### 1. Backend — resolve and store a cover image URL, not the bytes

- New `backend/src/utils/tripCoverImage.js` (or similar), exporting
  `resolveCoverImage(activities): Promise<string | null>`:
  - **Revised post-spec**: scans `activities` in order for the first `kind === 'attraction'`
    entry — not strictly `activities[0]`. A hike/bike-first trip falls through to the next
    attraction in the list rather than showing no image; only a trip with *no* attraction
    activities at all shows none. Reverses this spec's original "Out of scope" call after live
    testing surfaced the original strict-`activities[0]` behavior as too narrow in practice.
  - Otherwise calls MySwitzerland's attraction endpoint for that activity's `refId` (same URL
    shape/headers as `getAttraction`, extracted or duplicated — implementer's call which reads
    cleaner) with a fixed `lang=en` (only the image URL is needed, which doesn't vary by locale;
    no need to know/store what locale the user was browsing in when they added the activity), and
    returns `data.data.image?.[0]?.url ?? null` — MySwitzerland's single-record attraction
    response wraps the actual record one level deeper than the list endpoints
    (`{ meta, links, data: {...} }`), confirmed live and matching the double-unwrap the frontend's
    own `AttractionsService.getAttraction` already does (`res.data.data`) — an early implementation
    missed this and always silently resolved `null`.
  - Wrapped so a MySwitzerland failure (404/timeout/rate-limit) resolves `null` rather than
    throwing — a missing cover photo must never block saving a trip.
- `Trip.js`: new `coverImageUrl: { type: String, default: null }`.
- `createTrip`: when `isPublic`, `coverImageUrl: await resolveCoverImage(activities ?? [])`
  alongside the existing `distanceKm` computation.
- `updateTrip`: when `effectiveIsPublic` (existing variable) and `updates.activities` is present,
  `updates.coverImageUrl = await resolveCoverImage(updates.activities)` — mirrors the existing
  `if (updates.routeCoordinates) updates.distanceKm = ...` line right above it. Recomputed (not
  "once ever" like `slug`) so a later edit that removes/reorders activities keeps the cover photo
  in sync, including clearing it back to `null` if the trip no longer qualifies.
- Not computed at all for private trips (`isPublic`/`effectiveIsPublic` false) — no wasted
  MySwitzerland calls for trips `TripCard` never renders.

### 2. Frontend — model + card

- `SavedTrip` (`models/trip.ts`): new `coverImageUrl?: string | null;` — server-computed, flows
  into `PublicTrip` automatically via its existing `extends SavedTrip`.
- `trip-card.html`: when `trip.coverImageUrl` is set, render it as a photo on the card's front
  face (top, above the existing header — exact treatment is an implementation/visual call, not
  fixed here); plain `<img [src]="trip.coverImageUrl" loading="lazy" decoding="async">`, no
  backend involvement in loading the bytes. When absent (no activities, or the first one isn't an
  attraction, or the lookup failed), the card renders exactly as it does today — confirmed
  explicitly acceptable rather than treated as a bug state.

## Out of scope

- `trip-detail` (the standalone `/trips/:slug` page) — this spec only covers the Explore Trips
  grid card. `coverImageUrl` would be trivially available there too if wanted later.
- Re-attempting the earlier backend image-proxy/cache approach — not needed here since only a URL
  string is fetched server-side (already done everywhere images are involved), never image bytes.
- Any new attribution/copyright UI — this reuses the same attraction-image pipe already used
  elsewhere in the app (copyright-holder filtering already disabled app-wide, accepted risk).

## References

- @context/project-overview.md
