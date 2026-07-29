# OJP Location Search — Replace transport.opendata.ch `/locations`

**Status: implemented** (`feature/ojp-location-search`, not yet merged).

## Overview

The trip planner's stop-picker (`Step2Itinerary`, all four `p-autoComplete` fields) calls
`GET /api/v1/transport/locations`, which today proxies `transport.opendata.ch/v1/locations`
with a `type=station|address` param. That `type` filter is unreliable — transport.opendata.ch
is a thin community wrapper around search.ch's geodata and doesn't consistently honor it,
so road trips can get station results mixed into address search and vice versa.

This phase replaces only the locations lookup with opentransportdata.swiss's **OJP
(Open Journey Planner) 2.0** `LocationInformationRequest`, the official VDV/SIRI-standard
API. It's a backend-only swap: the response gets mapped into the exact same JSON shape the
frontend already consumes, so `TransportService.searchLocations()`, `Step2Itinerary`, and
every other frontend file are untouched.

**Explicitly out of scope (Phase 2, separate future spec):** `getConnections`/
`getConnectionJourneys` (the `/connections` and `/connections/journeys` endpoints that build
rail routing) stay on transport.opendata.ch for now. OJP's `TripRequest` could eventually
replace those too, but its `TimedLeg`/`ContinuousLeg` response model is structurally
different from the current HAFAS `sections`/`passList` shape that `mapSections()`/
`extractPassListCoords()` parse — a real rewrite, not a drop-in, and not needed to fix the
reported bug. Road routing (OSRM, `buildRoadRoute()` in `trip-planner.ts`) is untouched
either way — OJP doesn't do driving directions.

## Confirmed decisions

- **Endpoint**: `POST https://api.opentransportdata.swiss/ojp20` (OJP 2.0), body
  `Content-Type: application/xml`, `Authorization: Bearer <TOKEN>`. Env vars
  `OPENTRANSPORTDATA_ENDPOINT`/`TOKEN` already added by the user to `backend/config/.env`
  (confirmed correct endpoint value). Still need adding to `infra/.env`, `infra/.env.prod`
  (real files, not committed) and `infra/.env.prod.example` (committed template) before
  deploy.
- **Backend-only change.** `getLocations` in `backend/src/controllers/transport.js` builds
  the OJP XML request, POSTs it, parses the XML response, and maps it into the existing
  `LocationsResponse` shape (`{ success, data: { stations: [{ id, name, coordinate: {x, y}, type }] } }`)
  that `frontend/src/app/shared/services/transport.ts`'s `searchLocations()` already expects.
  Frontend interfaces (`LocationSearchResult`, `LocationResult`, `LocationsResponse`) and every
  Angular file are unchanged.
- **Type mapping**: the existing `type=station|address` query param (sent by the frontend based
  on `tripType`) drives OJP's place-type restriction — `station` restricts to `StopPlace`/
  `StopPoint`, `address` restricts to `Address`. **Defense in depth**: since an unreliable
  server-side type filter is the exact bug this feature fixes, the backend mapper also drops
  any `Location` in the response that doesn't actually contain the requested child element
  (`StopPlace`/`StopPoint` vs `Address`) before returning results — never trust the filter
  alone a second time.
- **Coordinates**: OJP's `GeoPosition` is plain WGS84 decimal-degree `Longitude`/`Latitude` —
  same as transport.opendata.ch's `coordinate.x`(lat)/`coordinate.y`(lon) today, so no
  reprojection (no `proj4`, unlike the geo.admin.ch/LV95 endpoints elsewhere in this codebase).
  Mapper writes `coordinate: { x: latitude, y: longitude }` to match the existing field meaning
  exactly.
- **Result id**: confirmed live — `StopPlace` results carry a stable `StopPlaceRef`
  (e.g. `ch:1:sloid:7000`), mapped to `id` as today (used later as `externalId` for rail
  connection lookups). `Address` results have no ref field, but do carry a stable-looking
  compound `PublicCode` string (e.g. `streetID:1500000111::23006356:-1:Bahnhofstrasse:...`) —
  used as `id` directly, with a `addr:{lat},{lon}` fallback only if it's ever absent. Either way
  this is low-stakes: `externalId` is never read for road trips (`buildRoadRoute()` only uses
  `lat`/`lon`).
- **Result count**: request `NumberOfResults = 8` (`PlacePolicyGroup`) to match the current
  typeahead dropdown's practical size — opendata.ch sent no explicit limit, so this is a new,
  deliberate cap rather than a behavior match.
- **New dependency**: `fast-xml-parser` added to `backend/package.json` (no XML parser exists
  in the backend today — `axios` alone doesn't parse XML). Zero transitive dependencies, used
  both to build the request (or a plain string template, see below) and parse the response.
- **XML escaping**: the search query text is user input inserted into an XML body — must be
  entity-escaped (`&`, `<`, `>`, `"`, `'`) when building the request, whether via string
  template or an XML builder. Getting this wrong both breaks on real Swiss place names
  containing `&`/apostrophes (e.g. "Coeur d'Alpes") and is an XML-injection risk otherwise.
- **Verified live** (2026-07-29, real key, both station and address queries against
  `https://api.opentransportdata.swiss/ojp20`): the public OJP cookbook pages found during
  research turned out to document **OJP 1.0**, not 2.0, and its request namespace prefixes are
  the *inverse* of what the real v2.0 endpoint accepts — 1.0 examples default to the SIRI
  namespace and prefix OJP elements with `ojp:`; the real v2.0 endpoint defaults to the
  `vdv.de/ojp` namespace and prefixes SIRI elements with `siri:` instead, uses `<Name>` (not
  `<LocationName>`) for the search text, and puts `Type`/`NumberOfResults` directly under
  `<Restrictions>` (not a `PlaceDataFilterGroup`/`PlacePolicyGroup` split). The confirmed working
  request/response shapes are documented below. **`Restrictions/Type` genuinely works** —
  station and address queries against the same text returned cleanly separated `StopPlace`-only
  vs `Address`-only result sets in live testing, the exact bug this feature exists to fix.
  **`NumberOfResults` is a soft hint, not a hard cap** — requests for 3 and 5 came back with
  6-8 results anyway, so the mapper truncates client-side instead of trusting it.

## Backend

### `backend/package.json`

- Add `"fast-xml-parser": "^4.x"` to `dependencies`.

### `backend/src/utils/ojp.js` (new — implemented, verified live)

Mirrors the existing pattern of factoring third-party API glue out of controllers (see
`schweizMobilRoutes.js`). Exports:

- `buildLocationInformationRequest(query, type)` — returns the XML string body, confirmed
  working against the real endpoint:
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <OJP xmlns="http://www.vdv.de/ojp" xmlns:siri="http://www.siri.org.uk/siri" version="2.0">
    <OJPRequest>
      <siri:ServiceRequest>
        <siri:RequestTimestamp>2026-07-29T14:07:49.035Z</siri:RequestTimestamp>
        <siri:RequestorRef>ActivSwitzerland</siri:RequestorRef>
        <OJPLocationInformationRequest>
          <siri:RequestTimestamp>2026-07-29T14:07:49.035Z</siri:RequestTimestamp>
          <InitialInput>
            <Name>Bern</Name>
          </InitialInput>
          <Restrictions>
            <Type>stop</Type>
            <NumberOfResults>8</NumberOfResults>
          </Restrictions>
        </OJPLocationInformationRequest>
      </siri:ServiceRequest>
    </OJPRequest>
  </OJP>
  ```
  `type=station` → `<Type>stop</Type>`, `type=address` → `<Type>address</Type>`. Query text is
  XML-entity-escaped before insertion.
- `parseLocationInformationResponse(xml, type)` — parses via `fast-xml-parser`
  (`isArray: name => name === 'PlaceResult'`, needed since a single-result response wouldn't
  otherwise come back as an array), walks
  `OJP.OJPResponse['siri:ServiceDelivery'].OJPLocationInformationDelivery.PlaceResult[]`. Each
  result's `Place` has either a `StopPlace` (`StopPlaceRef`, plus `Mode`/`PtMode` — unused) or an
  `Address` (`PublicCode`, `Street`, `HouseNumber`, `PostCode` — unused beyond `PublicCode`),
  a `Name.Text['#text']` display name (e.g. `"Bern Bümpliz Süd (Bern)"` /
  `"Bahnhofstrasse 8b (Muri b. Bern)"` — already locality-suffixed, good for typeahead as-is),
  and `GeoPosition['siri:Latitude']`/`['siri:Longitude']` (plain WGS84 decimal degrees, as
  expected — no reprojection). Each result is re-checked against the requested `type`
  (`StopPlace` present ⇒ keep only if `type !== 'address'`, `Address` present ⇒ keep only if
  `type === 'address'`) and truncated to 8 client-side. Returns the same shape `getLocations`
  already built before this feature: `{ stations: [{ id, name, coordinate: {x, y}, type }] }`.

### `backend/src/controllers/transport.js`

- `getLocations`: replaced. Instead of an axios `GET` to `TRP_ENDPOINT`, calls
  `buildLocationInformationRequest(req.query.location, req.query.type)`, POSTs it via axios to
  `process.env.OPENTRANSPORTDATA_ENDPOINT` with `accept`/`Content-Type: application/xml` and
  `Authorization: Bearer ${process.env.TOKEN}`, passes the raw XML response body through
  `parseLocationInformationResponse(xml, req.query.type)`, and responds
  `res.status(200).json({ success: true, data: { stations } })` — identical response envelope to
  today. Same `try/catch`/`ErrorResponse(500)` pattern as the rest of the file.
- `getConnections`/`getConnectionJourneys`: **unchanged** — still proxy
  `TRP_ENDPOINT`/transport.opendata.ch, per the Phase 2 scoping above.

### `backend/src/routes/transport.js`

- No changes — `GET /locations` keeps the same path and query params (`location`, `type`);
  only what's behind it changes.

### `infra/.env.prod.example`

- Add, near the existing `# transport` block:
  ```
  # opentransportdata.swiss (OJP location search)
  OPENTRANSPORTDATA_ENDPOINT=https://api.opentransportdata.swiss/ojp20
  TOKEN=<same-as-dev-or-a-dedicated-prod-token>
  ```
- `backend/config/.env` already has both (user-added, confirmed correct endpoint). `infra/.env`,
  `infra/.env.prod` (real, uncommitted files) still need the same two keys with the user's
  actual token.

## Frontend

- **No changes required anywhere.** `frontend/src/app/shared/services/transport.ts`'s
  `searchLocations()`, `LocationSearchResult`/`LocationResult`/`LocationsResponse`, and
  `Step2Itinerary`'s four `p-autoComplete` fields all consume the same JSON shape as before —
  confirmed by design, since the whole point of mapping OJP's XML into the existing
  `LocationsResponse` shape in the backend is to make this an invisible swap upstream.

## Open questions (not blocking, flag for later)

- Should the effective result cap be higher/lower than 8 once used with real queries in the UI —
  worth a quick UAT pass on both station and address search before considering it final.
- ~~Confirm whether OJP's `Address` results include enough of a human-readable name~~ — resolved
  live: `Place.Name.Text` is already locality-suffixed (`"Bahnhofstrasse 8b (Muri b. Bern)"`), no
  composition needed.
- Phase 2 (OJP `TripRequest` replacing rail connection-building) is intentionally deferred —
  revisit as its own spec once this phase has shipped and been used for a while.
- ~~Not yet exercised through the real frontend UI~~ — resolved: user rebuilt the Docker backend
  container and confirmed the stop-picker works for both road and rail trips. That surfaced one
  real bug not caught by direct-`curl` testing: the container reads env from `infra/.env`, not
  `backend/config/.env` — the new `OPENTRANSPORTDATA_ENDPOINT`/`TOKEN` vars had only been added to
  the latter. Fixed by adding them to `infra/.env` too.

## References

- @backend/src/controllers/transport.js
- @backend/src/utils/ojp.js
- @backend/src/routes/transport.js
- @backend/package.json
- @infra/.env.prod.example
- @frontend/src/app/shared/services/transport.ts (confirmed no changes needed)
- @frontend/src/app/features/trip-planner/step2-itinerary/step2-itinerary.ts (confirmed no changes needed)
- https://vdvde.github.io/OJP/release/2.0/documentation-tables/ojp.html#element_ojp__OJPLocationInformationRequest (OJP 2.0 schema reference)
- https://opentransportdata.swiss/en/cookbook/open-journey-planner-ojp/ (endpoint, auth, request envelope)
- https://opentransportdata.swiss/en/cookbook/development-miscellaneous-cookbook/howto-access-apis/ (API key usage)
