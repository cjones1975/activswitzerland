# OJP TripRequest — Replace transport.opendata.ch `/connections`

**Status: implemented, live-tested; not yet committed.** Branch: `feature/ojp-trip-request`.

## Overview

The rail trip planner's `ConnectionLegPicker` (one leg at a time — `fromStop`/`toStop`, no via
stops in the current UI or its only call site) calls `TransportService.getConnections()` and
`getConnectionJourneys()`, which today proxy `transport.opendata.ch/v1/connections`. That API
publishes no rate limit numbers, no SLA, and no production-use guarantee — it just points at
"the rate limit of timetable.search.ch," an upstream community service. This phase replaces both
calls with opentransportdata.swiss's **OJP 2.0 `TripRequest`**, the same API and the same
`OPENTRANSPORTDATA_ENDPOINT`/`TOKEN` already wired up for location search
(`ojp-location-search-spec.md`, implemented).

This continues that spec's explicitly-deferred Phase 2. Same shape of change: **backend-only**
where possible — the OJP XML response gets mapped into the existing `ConnectionResult`/
`ConnectionSection` JSON shape `TransportService` already parses, so `TripConnection`/
`TripSection` (`models/trip.ts`), `ConnectionLegPicker`, `ConnectionsDrawer`, and every template
stay untouched. One small, deliberate frontend change is included (see below) — everything else
is confirmed to map cleanly, verified against live API responses before writing this spec (see
"Verified live").

## Confirmed decisions

- **Endpoint/auth**: same `POST https://api.opentransportdata.swiss/ojp20`,
  `Authorization: Bearer ${TOKEN}` as location search. No new env vars, no new key.
- **No `Via` support.** Live-tested three request shapes for OJP's `<Via>` element (the
  cookbook-documented form, a `PlaceRef`-wrapped variant, and a minimal no-`LocationName` form;
  tried both a terminus station and a genuine through-station as the via point) — all three
  returned an identical `HTTP 500 "ODMCH OJP Service Unavailable"` gateway error, while the
  identical request with `Via` removed succeeds every time. The cookbook itself only claims
  single-`Via` support with no multi-via option regardless ("decompose into separate consecutive
  TripRequests" is its own documented workaround). **This is a non-issue for this codebase**:
  confirmed live that `ConnectionLegPicker` is the only caller of `getConnections`/
  `getConnectionJourneys`, always with exactly `[fromStop, toStop]` — the current UI has no via
  stops at all, so the existing `via[]`/`via` query-param plumbing in
  `backend/src/controllers/transport.js` and `TransportService` is already dead code relative to
  real usage. The new backend implementation drops via support entirely rather than working
  around the 500.
- **Verified live (2026-08-10)**: a real `OJPTripRequest` for Zürich HB → Bern returned HTTP 200
  in ~150ms server-side (`CalcTime: 143`) with 3 full itineraries, including genuine live-delay
  data (`TimetabledTime` vs `EstimatedTime` differing on most stops), live platform
  (`EstimatedQuay`), and per-fare-class occupancy — richer than anything transport.opendata.ch's
  "Prognosis" object documented. Full response saved and inspected field-by-field against the
  existing frontend model before committing to this design.
- **Stop resolution — `from`/`to` must be `StopPlaceRef`s, not free text.** OJP's `Origin`/
  `Destination` take a `PlaceRef`, unlike transport.opendata.ch's `/connections` which accepts
  plain station names. `TripStop.externalId` ("present if picked via rail station search") is
  already an OJP `StopPlaceRef` post-location-search-migration (e.g. `ch:1:sloid:7000`) — the
  rail stop picker only ever produces rail stops via that search, so `externalId` should be
  populated for every real call. Backend falls back to a `buildLocationInformationRequest`
  lookup (already implemented in `ojp.js`) only if `externalId` is absent, to resolve a plain
  name the same way the location endpoint does today — same defensive pattern as
  `parseLocationInformationResponse`'s "never trust a filter without re-checking it."
  - **Related latent bug this incidentally fixes**: `getConnectionJourneys` already sends
    `stops[0].externalId ?? stops[0].name` as `from`/`to` to transport.opendata.ch's
    HAFAS-based `/connections` today — but since the location-search migration, `externalId` is
    an OJP `sloid` ref, not the HAFAS id that API expects. Worth a quick live check once this
    phase ships (not blocking, not this phase's bug to fix retroactively), since moving `from`/
    `to` resolution onto OJP itself removes the mismatch by construction.
- **Date/time**: `req.query.date`/`req.query.time` combine into one ISO datetime for OJP's
  `DepArrTime`. Placed under `Origin` when `isArrivalTime !== 'true'` (depart-after search, the
  default and only case verified live), under `Destination` instead when `isArrivalTime ===
  'true'` (arrive-by search) — standard OJP semantics, **not yet live-tested**; flagged under
  Open Questions.
- **`limit` → `NumberOfResults`**: direct mapping (`getConnections` already sends `limit=6`).
- **Two OJP calls per user search, same as today's two HTTP calls.** `getConnections` and
  `getConnectionJourneys` stay separate routes/controllers, each independently building and
  parsing its own `TripRequest` — deliberately, to keep `TransportService`'s two-call contract
  (and `ConnectionLegPicker`'s `forkJoin` + journeys-as-richer-route-line-source logic) exactly
  as-is. This doubles OJP call volume per search (2 instead of 1), still trivially inside the
  50 req/min free-tier budget. **Noted as a future consolidation opportunity, explicitly out of
  scope here**: OJP already returns full route topology (every intermediate stop, with
  coordinates via `TripResponseContext.Places`) in a single `TripRequest` — a later pass could
  merge both endpoints into one call and delete `getConnectionJourneys` plus the frontend's
  second `forkJoin` branch, but that's a real frontend/service change and not needed to hit this
  phase's "minimal frontend diff" goal.
- **`duration` format**: `TripSection`/`TripConnection`'s `formatDuration()`
  (`connection-leg-picker.ts`) parses transport.opendata.ch's proprietary `/(\d+)d(\d+):(\d+)/`
  string. OJP returns ISO-8601 (`PT1H17M30S`, confirmed live). Backend mapper converts OJP
  duration → the same `NNdHH:MM:SS`-shaped string (e.g. `"00d01:17:30"`) so the existing regex
  needs no change.
- **`walk.duration`**: `formatWalk()` (`connection-leg-picker.ts`) divides the input by 60,
  confirming it's **seconds** (not minutes, despite one older spec's stale comment). OJP's
  `TransferLeg.Duration` is also ISO-8601 (`PT4M`, confirmed live) — backend mapper converts to
  total seconds.
- **`platform`**: `EstimatedQuay.Text`, falling back to `PlannedQuay.Text` — live platform data,
  an upgrade over whatever static/prognosis platform transport.opendata.ch returned.
- **`journey.category`/`.number`/`.direction`**: confirmed live these map directly —
  `Service.ProductCategory.ShortName.Text` returned exactly `"IR"`/`"IC"` in testing, matching
  the literal strings `trainColor()`/`categoryLabel()` already switch on with zero changes
  needed there. `.number` ← `Service.TrainNumber` (fallback `PublicCode`). `.direction` ←
  `Service.DestinationText.Text`.
- **`routeCoordinates`/`passList`**: OJP doesn't inline coordinates per leg — every stop
  referenced anywhere in the trip is listed once in `TripResponseContext.Places[]` with a
  `GeoPosition`, and legs reference stops by `StopPointRef`/`StopPlaceRef`. Mapper builds a
  `ref → {lat, lon}` lookup from `Places` once per response, then resolves each `LegBoard`/
  `LegIntermediate`/`LegAlight` against it to build the same `passList: [{station: {name,
  coordinate}}]` shape `extractPassListCoords()` already consumes. Needs `Params/
  IncludeIntermediateStops = true` in the request (confirmed live: without it, `LegIntermediate`
  entries — Baden, Brugg AG, Aarau, Olten on a real Zürich HB→Bern trip — don't appear).
- **`products`**: populated from `Service.ProductCategory` per leg. Confirmed via code search
  this field is assigned but never actually read in any template today — zero behavioral risk
  either way.
- **Not mapped this phase** (present in OJP's response but no corresponding field in
  `TripSection`/`TripConnection` today — noted as future enhancement, not required for parity):
  per-fare-class occupancy (`ExpectedDepartureOccupancy`), `EmissionCO2`, train-formation
  `Attribute`s (wifi, restaurant car, exit side).
- **Real bug found via live testing, fixed before implementation was considered done**:
  `fast-xml-parser` auto-types purely-numeric leaf text (`<EstimatedQuay><Text>15</Text>` → JS
  number `15`), while non-numeric platform codes (`"3CD"`) stay strings — a live response mixed
  both in the same result set. `platform?: string` on the frontend expects a string always;
  `platformOf()` now explicitly `String()`-coerces before returning.
- **`isArrivalTime = true` verified live** (previously flagged as designed-but-untested): placing
  `DepArrTime` under `Destination` instead of `Origin` genuinely changes the result set — a
  20:06 local arrive-by search returned trips departing 16:38–16:54 and arriving mostly before
  the deadline (one result landed ~15 min after it, which reads as OJP returning the
  closest-match trip on either side of the target rather than a strict pre-deadline filter —
  consistent with how commercial journey planners often behave, not treated as a bug).

## Backend

### `backend/src/utils/ojp.js`

New exports alongside the existing location-search functions:

- `buildTripRequest({ originRef, destRef, dateTime, isArrivalTime, numberOfResults })` — returns
  the XML string body:
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <OJP xmlns="http://www.vdv.de/ojp" xmlns:siri="http://www.siri.org.uk/siri" version="2.0">
    <OJPRequest>
      <siri:ServiceRequest>
        <siri:RequestTimestamp>...</siri:RequestTimestamp>
        <siri:RequestorRef>ActivSwitzerland</siri:RequestorRef>
        <OJPTripRequest>
          <siri:RequestTimestamp>...</siri:RequestTimestamp>
          <Origin>
            <PlaceRef>
              <StopPlaceRef>{originRef}</StopPlaceRef>
              <LocationName><Text>Origin</Text></LocationName>
            </PlaceRef>
            <!-- DepArrTime here when isArrivalTime is false -->
          </Origin>
          <Destination>
            <PlaceRef>
              <StopPlaceRef>{destRef}</StopPlaceRef>
              <LocationName><Text>Destination</Text></LocationName>
            </PlaceRef>
            <!-- DepArrTime here instead when isArrivalTime is true -->
          </Destination>
          <Params>
            <NumberOfResults>{numberOfResults}</NumberOfResults>
            <IncludeTrackSections>false</IncludeTrackSections>
            <IncludeLegProjection>false</IncludeLegProjection>
            <IncludeTurnDescription>false</IncludeTurnDescription>
            <IncludeIntermediateStops>true</IncludeIntermediateStops>
          </Params>
        </OJPTripRequest>
      </siri:ServiceRequest>
    </OJPRequest>
  </OJP>
  ```
  Confirmed working live (no-via case, both single-result and multi-result). No `Via` element —
  per the confirmed decision above.
- `parseTripResponse(xml)` — parses via `fast-xml-parser` (already a dependency), walks
  `OJP.OJPResponse['siri:ServiceDelivery'].OJPTripDelivery`. Builds the `StopPointRef/
  StopPlaceRef → {lat, lon}` lookup from `TripResponseContext.Places[]` first, then maps each
  `TripResult.Trip` into a `ConnectionResult`-shaped object (see field mapping above):
  `{ from: {departure, station: {name}}, to: {arrival, station: {name}}, duration, transfers,
  products, sections }`, with each `Leg` mapped to a `ConnectionSection` (`TimedLeg` →
  `{departure, arrival, journey}` with `journey.passList` resolved via the lookup; `TransferLeg`
  → `{walk: {duration}}`).
- Small ISO-8601 duration helpers (`isoDurationToHms(iso)` → `"NNdHH:MM:SS"` string,
  `isoDurationToSeconds(iso)` → number) — shared by both the trip-duration and walk-duration
  conversions above.

### `backend/src/controllers/transport.js`

- `getLocations`: **unchanged** (already OJP, implemented).
- `getConnections`: replaced. Resolves `from`/`to` to `StopPlaceRef`s (via `req.query.from`/`to`
  directly if they look like refs — i.e. the frontend now sends `externalId` — else via
  `buildLocationInformationRequest` as a fallback), builds the request with
  `buildTripRequest(...)`, POSTs to `OPENTRANSPORTDATA_ENDPOINT`, parses via
  `parseTripResponse`, responds `{ success: true, data: { connections } }` — same envelope as
  today. Drops `via[]` handling (see confirmed decision).
- `getConnectionJourneys`: replaced. Same `buildTripRequest`/`parseTripResponse` call (yes, a
  second OJP round-trip — see confirmed decision on scope), response reshaped to
  `{ success: true, data: { connections: [{ sections }] } }` matching today's `JourneysResponse`
  contract exactly (only `sections` populated, since that's all `extractPassListCoords()`
  reads).
- Both keep the existing `try/catch`/`ErrorResponse(500)` pattern used throughout this file and
  by `getLocations`.

### `backend/src/routes/transport.js`

- No changes — same paths (`/connections`, `/connections/journeys`), same query param names.

## Frontend

One small, deliberate change — everything else confirmed untouched:

- **`shared/services/transport.ts`, `getConnections()`**: `from`/`to` params change from
  `stops[0].name`/`stops[stops.length - 1].name` to `stops[0].externalId ?? stops[0].name`/
  `stops[stops.length - 1].externalId ?? stops[stops.length - 1].name` — matching what
  `getConnectionJourneys()` already does one function below it. Needed because OJP requires a
  `StopPlaceRef`, not a free-text name; harmless for `getConnectionJourneys` (no change there)
  since it already sends `externalId`.
- **No other changes**: `ConnectionResult`/`ConnectionSection`/`SectionStop`/`SectionJourney`/
  `SectionWalk` interfaces, `mapSections()`, `extractPassListCoords()`, `TripConnection`/
  `TripSection` (`models/trip.ts`), `ConnectionLegPicker`, `ConnectionsDrawer`, and every
  template/CSS file stay exactly as they are today — confirmed field-by-field above that OJP's
  response maps cleanly onto the shape they already consume.

## Open questions (not blocking, flag for later)

- Whether the `Via` 500 is a standing gap in the endpoint or a transient outage — irrelevant to
  this phase (no via support needed), but worth a retest some other day out of general interest
  given it failed identically three ways.
- Future consolidation: merge `getConnections`/`getConnectionJourneys` into one OJP call and
  delete the second `forkJoin` branch in `ConnectionLegPicker` — real frontend change, deferred
  out of this phase's minimal-diff scope.
- Whether to surface any of the richer OJP-only data (live occupancy, platform-live vs
  scheduled, CO2) in the UI later — no model/UI changes proposed here, noted for a future spec.
- The latent `externalId`-format mismatch in today's `getConnectionJourneys` (see confirmed
  decisions) — worth a quick live check that this phase actually fixes it as a side effect,
  once implemented.

## References

- @backend/src/controllers/transport.js
- @backend/src/utils/ojp.js
- @backend/src/routes/transport.js
- @frontend/src/app/shared/services/transport.ts
- @frontend/src/app/features/trip-planner/step2-itinerary/connection-leg-picker/connection-leg-picker.ts (only caller of `getConnections`/`getConnectionJourneys`, always exactly `[fromStop, toStop]`)
- @frontend/src/app/features/trip-planner/connections-drawer/connections-drawer.ts
- @frontend/src/app/models/trip.ts
- context/features/ojp-location-search-spec.md (Phase 1, implemented — this spec is its deferred Phase 2)
- context/features/transport-connection-detail-spec.md (established the `sections`/`TripSection` model this phase maps onto)
- https://opentransportdata.swiss/en/cookbook/ojptriprequest/ (TripRequest cookbook, including the `Via` documentation that live-testing found doesn't currently work)
- https://opentransportdata.swiss/en/limits-and-costs/ (OJP: 50 req/min, 20k/day free tier)
