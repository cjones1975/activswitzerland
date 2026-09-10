# Booking.com Hotel Deep Link

## Overview

The destinations drawer already has a "Find hotel" activity card that opens a `hotels` drawer, but
that drawer currently renders `HotelsStub` — a static "coming soon" placeholder
(`frontend/src/app/features/hotels/hotels-stub/`). This spec replaces that stub with a real booking
form that hands off to Booking.com via our Commission Junction (CJ) affiliate link, wrapped so CJ can
track the click.

Booking.com has no public API for resolving an arbitrary place name/coordinates to its own `dest_id`
without a separate Demand API partnership (a distinct application from our CJ affiliate account, with
its own approval process). Given that, and that MySwitzerland's own destination categorisation is
binary (`cities` / `villages`, ~28 vs ~435, no size-tiered "towns" bucket — confirmed live against
`MYS_ENDPOINT`), the agreed approach is a **manually curated, database-backed mapping table** covering
all 28 `cities` plus a hand-picked allowlist of 20 well-known villages, rather than dynamic resolution.
Only destinations present in this table show the "Find hotel" button — button visibility and deep-link
availability are the same check, so there is no path to a button that leads to a broken link.

## Current state (verified in code)

- `frontend/src/app/features/destinations/destination-detail/destination-detail.ts:102-108` — `openHotels()`
  closes `destination-detail` and opens the `hotels` drawer with `{ destination: dest }` as payload,
  unconditionally (no gating today).
- `destination-detail.html:47-51` — the "Find hotel" button (`activity-card-hotels`) is not wrapped in
  any conditional today, unlike the hikes/bike-rides cards which are gated on `hasGeo()`
  (`destination-detail.html:37-46`).
- `frontend/src/app/shared/drawer-host/drawer-host.ts:25,353-366` and `drawer-host.html:456-481` — the
  `hotels` drawer shell (header, back button, close button) already exists and already threads the
  `destination` payload through (`onHotelsBack()` reopens `destination-detail` with the same payload;
  `hotelsDestinationName()` reads `payload.destination.name` for the back-button label). Only the body
  (`<app-hotels-stub></app-hotels-stub>` at `drawer-host.html:480`) needs to change.
- `frontend/src/app/models/destination.ts` — the `Destination` interface has no category/classification
  field. The backend passes MySwitzerland's response through untouched
  (`backend/src/controllers/myswitzerland.js:119-154`, `getDestination`), so the raw API's
  `classification` array (see below) already reaches the client today — it's just untyped and unused.
- Live verification against `MYS_ENDPOINT` (2026-09-10): each destination record carries a
  `classification` array with an entry named `"placetypes"`, e.g. Bern →
  `{ name: 'placetypes', values: [{ name: 'cities', title: 'Cities' }] }`. Full enum across the ~4072
  destinations in the dataset: `cities` (28), `villages` (435), `regions` (305), `mountains` (50),
  `mountainlakes` (41), `valleys` (24), `smalllakes` (16), `islands` (14), `biglakes` (12),
  `natureparks` (7), `glaciers` (5), `lakes` (2), `mountainpasses` (2), `plain` (2), `forests` (1),
  `wildlifeparks` (1). Some destinations (e.g. "Diegten") carry no `placetypes` classification at all.
  This is not used for gating directly (see Requirements below — we gate on the mapping table, not on
  `placetypes` at render time), but it's how the 28 cities were enumerated and it's the reason the
  village allowlist had to be hand-picked rather than derived.
- No existing CJ/affiliate/booking.com integration exists anywhere in the codebase — this is greenfield.
  The closest precedent for "backend builds a full external redirect URL from env config, frontend just
  navigates to it" is `backend/src/controllers/billing.js:28-29` (Stripe `success_url`/`cancel_url`
  built from `process.env.FRONTEND_URL`).
- Precedent for a small, rarely-changing reference collection: `backend/src/models/Country.js` +
  `backend/src/controllers/country.js` (`Country.find()`, no filtering, frontend loads the whole list)
  and its seed file `backend/src/data/countries.json` (a plain JSON array, imported into Mongo directly
  — no seeder script is committed in the repo, so the same manual import step is expected here).
- `context/data/Booking_dest_Ids.csv` — the manually-sourced mapping already provided (28 cities + 20
  villages, mapped to real Booking.com `dest_id` values one at a time via `booking.com/searchresults.html`
  + browser devtools, since no bulk lookup is available without Demand API access).

## Mapping data

All 28 `cities` and the 20 requested villages were matched against MySwitzerland's `identifier` field
(verified live) and cross-referenced against `context/data/Booking_dest_Ids.csv` by name/order (the CSV
lost accents on export — e.g. "WinterThur"/"Neuchtel"/"Gruyres"/"Mrren"/"Delmont" — but its row order
matches the API's `facet.filter=placetypes:cities` order exactly, and the village list matches the order
originally requested, so every row was matched unambiguously). The full 48-row table (identifier, name,
category, destId, destType) is written up as the seed data in Requirement 1.

**Two dest_ids need verification before launch** — flagging per the "call out bad requirements before
building them" convention on this repo:

- **Klosters** → `4087` and **Rapperswil-Jona** → `900040764`. Every other entry in the CSV is a
  ~7-digit negative number (Booking.com's standard `city`-scope id format, e.g. Zurich `-2554935`).
  These two don't fit that pattern, which usually means Booking.com classifies them under a different
  `dest_type` (e.g. `district`/`region`) rather than `city`. Initially flagged and shipped as
  `dest_type: city` unverified; **user later verified Klosters directly against Booking.com and
  corrected it to `dest_type: region`** (`backend/src/data/hotelDestinations.json`, post-launch data
  edit — no schema change needed, exactly as anticipated by storing `destType` per-row rather than as
  a single global constant). Rapperswil-Jona remains unverified, still `dest_type: city`.
- **Resolved** (was flagged as an open question in an earlier draft of this spec, based on a bad first
  example): the CJ `cjevent` id is generated by CJ's own redirect server at click time, not by us. The
  correct mechanics, confirmed with a working example —
  input (what we build and send to CJ's redirect):
  ```
  https://www.anrdoezrs.net/click-101868930-14082404?url=https%3A%2F%2Fwww.booking.com%2Fsearchresults.html%3FCJEVENT%3D%7BeventId%7D%26ss%3DZurich%26dest_id%3D-2554935%26dest_type%3Dcity%26lang%3Dde%26selected_currency%3DCHF%26checkin%3D2026-09-11%26checkout%3D2026-09-12%26group_adults%3D2%26no_rooms%3D1
  ```
  what the user actually lands on after clicking through:
  ```
  https://www.booking.com/searchresults.html?CJEVENT=f4b80acaacfd11f1829200930a18b8f6&ss=Zurich&dest_id=-2554935&dest_type=city&lang=de&selected_currency=CHF&checkin=2026-09-11&checkout=2026-09-12&group_adults=2&no_rooms=1&aid=818287&label=affnetcj-14082404_pub-7775728_site-101868930_pname-ActivSwitzerland_clkid-_cjevent-f4b80acaacfd11f1829200930a18b8f6&utm_source=affnetcj&utm_medium=bannerindex&utm_campaign=de&utm_term=index-14082404
  ```
  So CJ's redirect (`anrdoezrs.net/click-<siteId>-<pid>`) does three things server-side once it receives
  our `url`: (1) substitutes the literal `CJEVENT={eventId}` placeholder we send with a freshly
  generated event id, (2) appends `aid`, `label` (with that same event id baked into its `cjevent-`
  suffix), and all four `utm_*` params on its own, using account/placement config it already holds for
  `site-101868930`/`pid-14082404` — none of that is something we construct or store. This **replaces**
  the redirect domain from the earlier (incorrect) example too: `www.anrdoezrs.net`, not
  `www.tkqlhce.com`. Net effect: our job shrinks to (a) including the literal `CJEVENT={eventId}` token
  as the first param on the booking.com URL we build, and (b) wrapping that URL through
  `anrdoezrs.net/click-<siteId>-<pid>?url=...` — no `aid`/`label`/`utm_*` construction needed on our
  side at all (Requirements 2 and 3 below are updated accordingly).
- **Resolved**: the four currencies are `CHF`/`EUR`/`GBP`/`USD` — confirmed `GDP` in the original
  request was a typo for `GBP`.

## Requirements

### 1. Backend — `HotelDestination` model + seed data

- New `backend/src/models/HotelDestination.js`, following the `Country.js` pattern:
  ```js
  const HotelDestinationSchema = new mongoose.Schema({
    identifier: { type: String, required: true, unique: true, trim: true }, // MySwitzerland destination identifier
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: ['city', 'village'], required: true },
    destId: { type: String, required: true, trim: true },
    destType: { type: String, required: true, trim: true, default: 'city' },
  });
  ```
  `destId` is stored as a `String` (not `Number`) — it's placed directly into a URL query string, so
  there's no arithmetic reason to parse it, and it avoids any formatting risk (leading `-`, or the
  9-digit `900040764` case) round-tripping through a numeric type.
- New seed file `backend/src/data/hotelDestinations.json`, a plain JSON array of all 48 rows (28
  cities + 20 villages), each `{ identifier, name, category, destId, destType }` — content below.
  Imported into Mongo the same way `countries.json` was (manual one-time import; no seeder script
  exists in this repo for `countries` either, so none is being introduced here).

<details>
<summary>Full 48-row seed data (identifiers verified live against MYS_ENDPOINT)</summary>

```json
[
  { "identifier": "e1e3b5e1-de0e-40a3-bac0-9e498869b4ce", "name": "Geneva", "category": "city", "destId": "-2552151", "destType": "city" },
  { "identifier": "de89fc29-50af-466c-a466-583b66cdef9c", "name": "Bern", "category": "city", "destId": "-2551235", "destType": "city" },
  { "identifier": "de23c0e4-dfce-4562-ab2f-ad9eab9867d8", "name": "Delémont", "category": "city", "destId": "-2551757", "destType": "city" },
  { "identifier": "d16b01bb-fa62-4334-b203-ca35d82cda9e", "name": "Solothurn", "category": "city", "destId": "-2554259", "destType": "city" },
  { "identifier": "ccbdc056-4dd5-4bc2-ac30-af0f769b30af", "name": "Biel", "category": "city", "destId": "-2551274", "destType": "city" },
  { "identifier": "c7b214a5-d32a-4321-89da-cae235a69400", "name": "Baden", "category": "city", "destId": "-2551141", "destType": "city" },
  { "identifier": "ade68dc3-15ce-47c4-bb9b-b318d8dbd92d", "name": "La Chaux-de-Fonds", "category": "city", "destId": "-2552726", "destType": "city" },
  { "identifier": "acd0accd-ac93-475a-a067-f20a7cd8a979", "name": "Aarau", "category": "city", "destId": "-2550904", "destType": "city" },
  { "identifier": "a65fba70-64cd-4914-a4d0-6977c2c7646a", "name": "Zug", "category": "city", "destId": "-2554922", "destType": "city" },
  { "identifier": "9c620c93-342d-43da-8fc3-9a284a72628f", "name": "Locarno", "category": "city", "destId": "-2552936", "destType": "city" },
  { "identifier": "9ac9f3f5-cbc9-4a07-832d-3f5321c18340", "name": "Olten", "category": "city", "destId": "-2553518", "destType": "city" },
  { "identifier": "98e453b0-55e6-4136-be83-5545f14c699d", "name": "Winterthur", "category": "city", "destId": "-2554859", "destType": "city" },
  { "identifier": "87acbf8b-502d-4a38-9bd9-a03cfe3fb330", "name": "St. Gallen", "category": "city", "destId": "-2554000", "destType": "city" },
  { "identifier": "87487fe3-bd11-429d-9550-61ba4ea716cd", "name": "Zurich", "category": "city", "destId": "-2554935", "destType": "city" },
  { "identifier": "84cb3524-2fdd-452d-8cd6-2f7c4dc50bdf", "name": "Fribourg", "category": "city", "destId": "-2552078", "destType": "city" },
  { "identifier": "6b6793fb-f795-4271-9f4b-a783bcb501a9", "name": "Rapperswil-Jona", "category": "city", "destId": "900040764", "destType": "city" },
  { "identifier": "5ec3e36c-e74f-4f0a-95a8-ec88c9ea4c8a", "name": "Chur", "category": "city", "destId": "-2551622", "destType": "city" },
  { "identifier": "5bcd33bd-c629-4404-a780-a9a640fd0b44", "name": "Lausanne", "category": "city", "destId": "-2552809", "destType": "city" },
  { "identifier": "58f7d1dc-ab48-4421-81b5-f26dcc27b923", "name": "Brig", "category": "city", "destId": "-2551394", "destType": "city" },
  { "identifier": "56cb1407-594a-4344-89da-79f3fea85de6", "name": "Neuchâtel", "category": "city", "destId": "-2553318", "destType": "city" },
  { "identifier": "4fabc28f-04ef-437f-9dc4-2ad89e1b0eb9", "name": "Basel", "category": "city", "destId": "-2551183", "destType": "city" },
  { "identifier": "395c7755-d92c-41f0-b85f-e3a9cf1a8294", "name": "Bellinzona", "category": "city", "destId": "-2551220", "destType": "city" },
  { "identifier": "23af589f-4dd0-4a25-96fc-f2da9b8de2e3", "name": "Schaffhausen", "category": "city", "destId": "-2554061", "destType": "city" },
  { "identifier": "1d1bc37a-6119-41ba-bd8c-3a627c2b9f93", "name": "Sion / Sitten", "category": "city", "destId": "-2554247", "destType": "city" },
  { "identifier": "122c3023-b70d-4a32-be9c-743f6f8fd435", "name": "Lugano", "category": "city", "destId": "-2552969", "destType": "city" },
  { "identifier": "0e5e3244-0ebc-4f1b-9ff4-dfdd6830131f", "name": "Montreux", "category": "city", "destId": "-2553210", "destType": "city" },
  { "identifier": "0a19e588-0b2b-4a9d-8e40-a425502e1637", "name": "Frauenfeld", "category": "city", "destId": "-2552069", "destType": "city" },
  { "identifier": "02b44434-4cf3-4b56-b273-d163a59c0663", "name": "Thun", "category": "city", "destId": "-2554447", "destType": "city" },
  { "identifier": "3a75caaf-aa16-4ba1-82a9-c800ca08336d", "name": "Zermatt", "category": "village", "destId": "-2554901", "destType": "city" },
  { "identifier": "d58cc682-c65f-4e5d-8164-4ab16261e4e7", "name": "St. Moritz", "category": "village", "destId": "-2554009", "destType": "city" },
  { "identifier": "46df259a-d79f-47c2-bd65-4954cef65258", "name": "Gstaad", "category": "village", "destId": "-2552338", "destType": "city" },
  { "identifier": "b92e2cfa-0216-4832-b38e-8fadb29d3b04", "name": "Lauterbrunnen", "category": "village", "destId": "-2552811", "destType": "city" },
  { "identifier": "a91fb430-4cd3-4d6f-8f02-3acd48befae1", "name": "Grindelwald", "category": "village", "destId": "-2552301", "destType": "city" },
  { "identifier": "96a79be3-c1f5-497d-8d23-39175ca90e30", "name": "Wengen", "category": "village", "destId": "-2554808", "destType": "city" },
  { "identifier": "200cf3c7-fc69-4ece-9dc2-9bb49ed343aa", "name": "Mürren", "category": "village", "destId": "-2553282", "destType": "city" },
  { "identifier": "4cedd4b0-97fd-4c61-aa20-ad38da972ff8", "name": "Engelberg", "category": "village", "destId": "-2551893", "destType": "city" },
  { "identifier": "067c43a1-12ec-4908-8cca-941961010196", "name": "Saas-Fee", "category": "village", "destId": "-2553924", "destType": "city" },
  { "identifier": "3de6c29a-b95e-4f10-a440-b641ff988a6d", "name": "Pontresina", "category": "village", "destId": "-2553646", "destType": "city" },
  { "identifier": "9e63cd28-f18e-4c49-8e14-488d7aeb96c8", "name": "Davos", "category": "village", "destId": "-2551753", "destType": "city" },
  { "identifier": "27240e44-1e3d-4288-9728-df613a4e6bbf", "name": "Klosters", "category": "village", "destId": "4087", "destType": "region" },
  { "identifier": "2f32e2a0-ce17-42a3-8568-5822c446ce59", "name": "Andermatt", "category": "village", "destId": "-2551037", "destType": "city" },
  { "identifier": "ee4aaf40-62f9-4e81-bf9e-96f9b9eabd06", "name": "Interlaken", "category": "village", "destId": "-2552548", "destType": "city" },
  { "identifier": "963d4f5c-b11a-4ea7-ab68-3b31b841fcf9", "name": "Gruyères", "category": "village", "destId": "-2552336", "destType": "city" },
  { "identifier": "399ddbf6-9fdf-4023-98d3-9112c76158f6", "name": "Appenzell", "category": "village", "destId": "-2551047", "destType": "city" },
  { "identifier": "267b00d6-9880-456c-a6a4-15de9eba464d", "name": "Ascona", "category": "village", "destId": "-2551089", "destType": "city" },
  { "identifier": "75508cff-9508-4eeb-8d13-66dd06e1fa7a", "name": "Stein am Rhein", "category": "village", "destId": "-2554334", "destType": "city" },
  { "identifier": "d122db6b-17c8-4386-abe2-0d90946c791e", "name": "Brienz", "category": "village", "destId": "-2551390", "destType": "city" },
  { "identifier": "4e7a1cce-078d-4540-ac69-386c530627d1", "name": "Murten", "category": "village", "destId": "-2553283", "destType": "city" }
]
```

</details>

`destType` is `"city"` for every row except Klosters, corrected to `"region"` after user verification
(see "Mapping data" above). Rapperswil-Jona remains unverified, still `"city"`.

### 2. Backend — routes/controller

- New `backend/src/controllers/hotels.js`, following the existing controller conventions
  (`asyncHandler`, `ErrorResponse`):
  - `getHotelDestinations` — `GET /api/v1/hotels/destinations` → `HotelDestination.find()`, returns
    `{ success: true, data: [...] }`. Small, static-ish list; no pagination needed (mirrors
    `getCountries`).
  - `getHotelDeeplink` — `GET /api/v1/hotels/deeplink`, query params: `identifier`, `checkin`,
    `checkout`, `groupAdults`, `groupChildren`, `noRooms`, `currency`, `lang`.
    - Look up `HotelDestination.findOne({ identifier })`; if not found, `next(new ErrorResponse('Destination is not mapped for hotel search', 404))`.
      This is the server-side enforcement backstop — the frontend button is already gated on the same
      mapping table (Requirement 4), but this stops a crafted/stale request from producing a link for
      an unmapped destination.
    - Validate: `checkin`/`checkout` are `YYYY-MM-DD`, `checkout` is strictly after `checkin`;
      `groupAdults >= 1`; `noRooms >= 1`; `groupChildren >= 0`; `currency` is one of `CHF`/`EUR`/`GBP`/`USD`.
      Return `400` via `ErrorResponse` on any failure.
    - Build the Booking.com URL. `CJEVENT={eventId}` must appear verbatim (literal curly braces,
      un-substituted — CJ's redirect server fills this in at click time) as the first param:
      ```
      https://www.booking.com/searchresults.html
        ?CJEVENT={eventId}
        &ss=<destination.name>
        &dest_id=<destination.destId>
        &dest_type=<destination.destType>
        &lang=<lang>
        &selected_currency=<currency>
        &checkin=<checkin>
        &checkout=<checkout>
        &group_adults=<groupAdults>
        &no_rooms=<noRooms>
        &group_children=<groupChildren>
      ```
      No `aid`/`label`/`utm_*` params here — CJ's redirect appends those itself (see "Mapping data"
      above). When this string is percent-encoded to embed it in the wrapper `url` param below,
      `{`/`}` become `%7B`/`%7D` automatically (plain `encodeURIComponent`), matching the confirmed
      working example exactly.
    - Wrap it in the CJ redirect: `` `https://${process.env.CJ_REDIRECT_HOST}/click-${process.env.CJ_SITE_ID}-${process.env.CJ_PID}?url=${encodeURIComponent(bookingUrl)}` ``.
    - Return `{ success: true, data: { url } }`. This mirrors the existing convention of building
      full external redirect URLs server-side (`billing.js:28-29`), so the CJ site/pid config lives in
      one place (env vars) and can be rotated without a frontend rebuild.
- New `backend/src/routes/hotels.js` wiring both handlers, mounted in `server.js` as
  `app.use('/api/v1/hotels', hotels)` (alongside the other `app.use('/api/v1/...)` lines).

### 3. Backend — new env vars

Add to `backend/config/.env`, `infra/.env`, `infra/.env.prod`, and `infra/.env.prod.example` (the last
of these currently holds live secrets pasted in place of placeholders and is deliberately left
uncommitted — add the new keys there too but do not stage that file):

```
CJ_REDIRECT_HOST=www.anrdoezrs.net
CJ_SITE_ID=101868930
CJ_PID=14082404
```

No `aid`/`label`/`utm_*` env vars are needed — CJ's redirect server appends those automatically based
on the site/pid pair (see "Mapping data" above).

### 4. Frontend — `HotelsService`

- New `frontend/src/app/shared/services/hotels.ts`, following the `DestinationsService`/`Country`
  pattern:
  - Loads `GET /api/v1/hotels/destinations` once (cached signal — 48 rows, effectively static data,
    no reason to refetch per drawer open).
  - `mappingFor(identifier: string): HotelDestinationMapping | undefined` — synchronous lookup used
    both for button-visibility gating and for reading `destId`/`destType` when building the deep link.
  - `getDeeplink(params): Observable<{ url: string }>` — thin wrapper over
    `GET /api/v1/hotels/deeplink`.
- New `HotelDestinationMapping` interface (`identifier`, `name`, `category`, `destId`, `destType`) —
  wherever `Destination` model types live, or alongside the service.

### 5. Frontend — gate the "Find hotel" button on the mapping table

- `destination-detail.ts`: add `hasHotelMapping = computed(() => !!this.hotelsSvc.mappingFor(this.destination()?.identifier ?? ''))`,
  mirroring the existing `hasGeo` computed at `destination-detail.ts:36-39`.
- `destination-detail.html:47-51`: wrap the `activity-card-hotels` button in `@if (hasHotelMapping())`,
  the same pattern already used for the hikes/bike-rides cards (`@if (hasGeo())` at line 37).

### 6. Frontend — hotel booking form (replaces `HotelsStub`)

- Delete `frontend/src/app/features/hotels/hotels-stub/` and replace it with a new component (e.g.
  `frontend/src/app/features/hotels/hotel-search/hotel-search.ts`), wired into `drawer-host.ts`'s
  imports array and swapped in at `drawer-host.html:480` in place of `<app-hotels-stub>`. The existing
  drawer chrome (header, back button reading `hotelsDestinationName()`, close button) stays as-is —
  only the body changes.
- Reads `destination` off the same drawer payload already passed through today
  (`this.drawerSvc.getPayload<...>('hotels')`, same shape `openHotels()` already sends).
- Form fields, built with PrimeNG components to match the rest of the app rather than native inputs —
  this drawer sits one step away from the trip planner's own `step1-my-trip`
  (`frontend/src/app/features/trip-planner/step1-my-trip/`), which already solves the near-identical
  "date range + guest counts" shape with PrimeNG, so this form follows the same component choices and
  markup conventions rather than introducing new ones:
  - **Check-in / check-out**: a single `p-datepicker` (`import { DatePicker } from 'primeng/datepicker'`)
    with `selectionMode="range"`, mirroring `step1-my-trip.html:33-43` exactly (`[minDate]="minDate"`
    pinned to today, `[showIcon]="true"`, `[readonlyInput]="true"`, `dateFormat="dd.mm.yy"` for display —
    converted to `YYYY-MM-DD` for the two separate `checkin`/`checkout` wire params only when calling
    `HotelsService.getDeeplink`). Default range: tomorrow → the day after. Same `null`-not-`[null,null]`
    empty-value handling as the existing range picker (see the doc comment on `dateRangeValue` in
    `step1-my-trip.ts:53-66` — the same gotcha applies here since it's PrimeNG's range-picker internals,
    not something specific to that component instance).
  - **Number of adults** (`group_adults`): `p-inputNumber` (`import { InputNumber } from 'primeng/inputnumber'`),
    `[min]="1" [showButtons]="true"`, default 2 — same attribute shape as `step1-my-trip.html:48`.
  - **Number of children** (`group_children`): `p-inputNumber`, `[min]="0" [showButtons]="true"`, default 0.
    Note: Booking.com's own search normally expects a per-child `age` value once `group_children > 0` —
    this spec does not add age inputs (not requested), so children-count-only links will land on
    Booking.com with children counted but no ages set; flagging as a known limitation rather than
    silently building it and hoping it round-trips cleanly.
  - **Number of rooms** (`no_rooms`): `p-inputNumber`, `[min]="1" [showButtons]="true"`, default 1.
  - **Currency** (`selected_currency`): `p-select` (`import { Select } from 'primeng/select'`) over a
    static 4-item options array (`CHF`/`EUR`/`GBP`/`USD`), same `optionLabel`/`optionValue` shape as the
    country select in `register.html:30-38` (here `optionLabel === optionValue`, just the currency code
    itself — no separate display-label list needed). Default `CHF`.
- A "Search on Booking.com" button: `p-button` (`import { Button } from 'primeng/button'`), matching
  `step1-my-trip.html:63-64`'s attribute shape (`[label]`, `icon`, `styleClass="w-full"`, `[disabled]`,
  `(onClick)`). On click, calls `HotelsService.getDeeplink(...)` with the current destination's
  `identifier`, the form values, and the active app locale (`LangService`, already injected elsewhere in
  this drawer stack) as `lang`; on success, opens the returned `url` via
  `window.open(url, '_blank', 'noopener')`. Disabled while the request is in flight or the form is
  invalid.
- i18n: new keys for the form labels/button/placeholder text, added to all 5 locale files
  (en/de/fr/it/es) in the same pass, per existing repo convention.

### 7. Frontend — remove the trip planner's "Hotels" activity entry

- The `hotels` drawer has a second, unrelated entry point today: `step3-activities.ts:66-69` /
  `step3-activities.html:30-35` opens it per trip stop with a `GeoPoint` (`{ id, name, lat, lon }`),
  never a MySwitzerland `Destination` — trip stops are free-text/map-picked locations, not entries from
  the MySwitzerland catalogue, so they can never have a `HotelDestination` mapping row (that table is
  keyed by MySwitzerland `identifier`, which a `GeoPoint` doesn't have). This entry point currently just
  opens the same "coming soon" stub. Removing it rather than adapting it: a hotel search from mid-trip
  planning can't write anything back into the trip (no stay gets recorded against the stop), so it
  doesn't fit this drawer's new job of handing off to Booking.com — a "search hotels" affordance makes
  more sense later against a *saved* trip (where a stay could plausibly be tied to a stop), not here.
- Remove the `s3-category-row--hotels` button block from `step3-activities.html`, the `openHotels()`
  method from `step3-activities.ts`, and the now-unused `.s3-category-hint`/`.s3-category-row--hotels`
  rules from `step3-activities.css`.
- Remove the now-unused i18n keys `trip.planner.step3.hotelsNearby` /
  `trip.planner.step3.hotelsComingSoon` from all 5 locale files.
- With this removed, `hotels` is only ever opened from `destination-detail.ts` (always with a full
  `Destination`, never `mode: 'select'`) — simplify `onHotelsBack()` in `drawer-host.ts` to drop the
  now-unreachable `payload?.mode === 'select'` branch and always reopen `destination-detail`.
- `/assets/hotel.png` is left in place (unused by code after this, but not deleted — plausibly reused
  for the future saved-trip entry point mentioned above).

### 8. Frontend — mobile bottom-sheet parity

`context/features/mobile-drawer-bottom-sheet-spec.md` converted `destination-detail`/`all-attractions`/
`attraction-detail`/`hikes`/`hike-detail`/`bikes`/`bike-detail` to a mobile (`<768px`) bottom sheet (75%
viewport height, map visible above, non-modal, rounded top corners, expand/collapse caret + X close),
but explicitly deferred `hotels` (along with `weather`/`connections`) as "worth deciding separately."
Decided here: **hotels joins the same treatment**, since it's opened from `destination-detail` exactly
like hikes/bikes are (open a picker, "back to destination" chevron) — leaving it on the old fixed-width
left-slide would make it the only inconsistent drawer in that family, and was also the direct cause of
a real bug (`.hotels-drawer` was missing from `drawer-host.css`'s `max-width: 767px { width: 100vw }`
list, leaving a 20px gap on mobile instead of full width).

- `drawer-host.ts`: new `hotelsMobileSheet = computed(() => this.breakpoint.isMobile())` — no
  trip-planner-mode gate needed (same reasoning as `destinationDetailMobileSheet`: hotels has no
  `select`-mode variant after Requirement 7 removed its only such caller).
- `drawer-host.html`'s `hotels` `p-drawer`: `[modal]`, `[position]`, `[style]`, and `[styleClass]` all
  made conditional on `hotelsMobileSheet()`, mirroring the `hikes`/`destination-detail` blocks exactly.
  Header gets the same `@if (hotelsMobileSheet())` split: the sheet variant (caret + X) is new; the
  `@else` variant is hotels' pre-existing header (chevron + label + X), left completely unchanged, same
  as how the original rollout preserved each of the seven drawers' existing tablet-width header.
- `drawer-host.css`: added `.hotels-drawer` to the `max-width: 767px` full-width list (the actual fix
  for the reported bug) — it was already present in the `min-width: 1280px` docked-sidebar list.
- `hotel-search.css`: added a `max-width: 400px` breakpoint collapsing the adults/children and
  rooms/currency two-column rows to one column each, since PrimeNG's default `stacked` InputNumber
  button layout still leaves each field fairly narrow at very small phone widths.

## Out of scope

- Any dynamic/API-driven `dest_id` resolution (Booking.com Demand API integration) — explicitly
  deferred; this spec is the static-mapping-table path chosen instead.
- Extending the village allowlist beyond the 20 requested, or any UI for admins to add more mapped
  destinations later — today that means a new DB row (or seed-file entry) added by hand.
- Child age (`age`) inputs on the booking form.
- Any other MySwitzerland placetype (`regions`, `valleys`, `islands`, `plain`, etc.) ever qualifying for
  the hotel button — treated as non-qualifying per the decision made during scoping.
- A "search hotels" entry point against a *saved* trip/stop — mentioned as a possible future addition
  (Requirement 7) but not designed or built here.

## References

- @context/data/Booking_dest_Ids.csv — source mapping data for Requirement 1's seed.
- @context/project-overview.md
