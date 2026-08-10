import { XMLParser } from 'fast-xml-parser';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // `Place` is only forced to an array under TripResponseContext/Places — PlaceResult.Place
  // (location search) is always a single element and must stay an object there.
  isArray: (name, jpath) =>
    name === 'PlaceResult' || name === 'Mode' ||
    name === 'TripResult' || name === 'Leg' || name === 'LegIntermediate' ||
    (name === 'Place' && jpath.endsWith('Places.Place')),
});

// transport.js's `type` query param -> OJP's Restrictions/Type value
const OJP_PLACE_TYPE = { station: 'stop', address: 'topographicPlace' };

const VALID_LANGS = ['en', 'de', 'fr', 'it'];

// Doubles as the recognized-PtMode allowlist (anything else is silently dropped) and the fixed
// render order icons appear in, regardless of the order OJP lists a stop's Mode entries in.
// Confirmed live: the cable-car value is `telecabin`, not `telecabine` (guessed wrong pre-live-test)
// — there is no separate `funicular` PtMode value; rack/cable railways like Zermatt's GGB use `telecabin`.
const PT_MODE_ORDER = ['bus', 'trollybus', 'rail', 'tram', 'metro', 'water', 'telecabin', 'cableway', 'air'];

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Confirmed live against api.opentransportdata.swiss/ojp20: the default (unprefixed) namespace is
// vdv.de/ojp, siri.org.uk/siri elements are prefixed `siri:` — the inverse of the sample requests
// published in opentransportdata.swiss's own OJP 1.0 cookbook pages, which don't work against v2.0.
export function buildLocationInformationRequest(query, type, lang) {
  const now = new Date().toISOString();
  const restrictionType = OJP_PLACE_TYPE[type] ?? 'stop';
  const restrictionLang = VALID_LANGS.includes(lang) ? lang : 'en';
  return `<?xml version="1.0" encoding="UTF-8"?>
<OJP xmlns="http://www.vdv.de/ojp" xmlns:siri="http://www.siri.org.uk/siri" version="2.0">
  <OJPRequest>
    <siri:ServiceRequest>
      <siri:RequestTimestamp>${now}</siri:RequestTimestamp>
      <siri:RequestorRef>ActivSwitzerland</siri:RequestorRef>
      <OJPLocationInformationRequest>
        <siri:RequestTimestamp>${now}</siri:RequestTimestamp>
        <InitialInput>
          <Name>${escapeXml(query)}</Name>
        </InitialInput>
        <Restrictions>
          <Type>${restrictionType}</Type>
          <Language>${restrictionLang}</Language>
          <NumberOfResults>8</NumberOfResults>
        </Restrictions>
      </OJPLocationInformationRequest>
    </siri:ServiceRequest>
  </OJPRequest>
</OJP>`;
}

const MAX_RESULTS = 8;

/**
 * `type` is the same `station`/`address` value the request was built with. OJP's own Restrictions/Type
 * filter was confirmed live to work correctly (unlike transport.opendata.ch's), but every result is
 * re-checked against the actual `StopPlace`/`TopographicPlace`/`Address` child present anyway — the
 * whole point of this feature is not trusting a type filter a second time. `NumberOfResults` was also
 * confirmed live to be a soft hint (the API can return a couple more than asked), so results are
 * hard-capped here too.
 */
export function parseLocationInformationResponse(xml, type) {
  const parsed = xmlParser.parse(xml);
  const delivery = parsed?.OJP?.OJPResponse?.['siri:ServiceDelivery']?.OJPLocationInformationDelivery;
  const results = delivery?.PlaceResult ?? [];
  const wantStation = type !== 'address';

  const stations = [];
  for (const result of results) {
    const place = mapPlace(result.Place);
    if (!place) continue;
    if (wantStation ? place.type !== 'station' : place.type !== 'address') continue;
    stations.push(place);
    if (stations.length >= MAX_RESULTS) break;
  }
  return stations;
}

function textOf(nameStruct) {
  return nameStruct?.Text?.['#text'] ?? nameStruct?.Text ?? '';
}

function extractModes(modeList) {
  const seen = new Set();
  for (const mode of modeList ?? []) {
    if (mode?.PtMode) seen.add(mode.PtMode);
  }
  return PT_MODE_ORDER.filter(m => seen.has(m));
}

// Confirmed live: OJP's `<Via>` element (tried three request shapes, two different via stops)
// consistently 500s on this endpoint. Irrelevant here — the only caller of buildTripRequest
// never has a via stop — so no Via support is attempted.
export function buildTripRequest({ originRef, destRef, dateTime, isArrivalTime, numberOfResults }) {
  const now = new Date().toISOString();
  const depArrTime = `<DepArrTime>${escapeXml(dateTime)}</DepArrTime>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<OJP xmlns="http://www.vdv.de/ojp" xmlns:siri="http://www.siri.org.uk/siri" version="2.0">
  <OJPRequest>
    <siri:ServiceRequest>
      <siri:RequestTimestamp>${now}</siri:RequestTimestamp>
      <siri:RequestorRef>ActivSwitzerland</siri:RequestorRef>
      <OJPTripRequest>
        <siri:RequestTimestamp>${now}</siri:RequestTimestamp>
        <Origin>
          <PlaceRef>
            <StopPlaceRef>${escapeXml(originRef)}</StopPlaceRef>
            <LocationName><Text>Origin</Text></LocationName>
          </PlaceRef>
          ${!isArrivalTime ? depArrTime : ''}
        </Origin>
        <Destination>
          <PlaceRef>
            <StopPlaceRef>${escapeXml(destRef)}</StopPlaceRef>
            <LocationName><Text>Destination</Text></LocationName>
          </PlaceRef>
          ${isArrivalTime ? depArrTime : ''}
        </Destination>
        <Params>
          <NumberOfResults>${Number(numberOfResults) || 6}</NumberOfResults>
          <IncludeTrackSections>false</IncludeTrackSections>
          <IncludeLegProjection>false</IncludeLegProjection>
          <IncludeTurnDescription>false</IncludeTurnDescription>
          <IncludeIntermediateStops>true</IncludeIntermediateStops>
        </Params>
      </OJPTripRequest>
    </siri:ServiceRequest>
  </OJPRequest>
</OJP>`;
}

// All Swiss stops are Europe/Zurich; the frontend's date/time inputs are picked in that zone.
// OJP's DepArrTime needs a real UTC instant, so we resolve the CET/CEST offset for the requested
// date via Intl (DST-correct) rather than assuming a fixed offset.
export function zurichLocalToUtcIso(date, time) {
  if (!date) return new Date().toISOString();
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  const guessUtc = Date.UTC(y, m - 1, d, hh, mm);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Zurich', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(guessUtc)).map(p => [p.type, p.value]));
  const zurichAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guessUtc - (zurichAsUtc - guessUtc)).toISOString();
}

function isoDurationToSeconds(iso) {
  const match = String(iso ?? '').match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!match) return 0;
  const [, days, hours, minutes, seconds] = match;
  return (Number(days) || 0) * 86400 + (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60 + Math.round(Number(seconds) || 0);
}

// transport.opendata.ch's proprietary duration string, still parsed by the frontend's
// formatDuration() via /(\d+)d(\d+):(\d+)/ — kept as the wire format so that regex needs no change.
function secondsToDurationString(totalSeconds) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = n => String(n).padStart(2, '0');
  return `${pad(days)}d${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function buildPlacesLookup(places) {
  const list = Array.isArray(places) ? places : (places ? [places] : []);
  const lookup = new Map();
  for (const place of list) {
    const lat = place?.GeoPosition?.['siri:Latitude'];
    const lon = place?.GeoPosition?.['siri:Longitude'];
    if (lat == null || lon == null) continue;
    const ref = place.StopPlace?.StopPlaceRef ?? place.StopPoint?.['siri:StopPointRef'] ?? place.TopographicPlace?.TopographicPlaceCode;
    if (!ref) continue;
    lookup.set(ref, { x: Number(lat), y: Number(lon) });
  }
  return lookup;
}

function platformOf(stop) {
  // fast-xml-parser auto-types purely-numeric leaf text (e.g. "15" -> 15), but "3CD"-style
  // platform codes stay strings — coerce so the frontend's `platform?: string` always gets one.
  const platform = textOf(stop?.EstimatedQuay) || textOf(stop?.PlannedQuay);
  return platform !== '' ? String(platform) : undefined;
}

function buildPassList(timedLeg, placesLookup) {
  const stops = [timedLeg.LegBoard, ...(timedLeg.LegIntermediate ?? []), timedLeg.LegAlight].filter(Boolean);
  return stops.map(stop => {
    const ref = stop['siri:StopPointRef'];
    const coordinate = ref ? placesLookup.get(ref) : undefined;
    return { station: { name: textOf(stop.StopPointName), ...(coordinate ? { coordinate } : {}) } };
  });
}

function mapLeg(leg, placesLookup) {
  if (leg.TimedLeg) {
    const { LegBoard: board, LegAlight: alight, Service: service } = leg.TimedLeg;
    const category = textOf(service?.ProductCategory?.ShortName);
    const number = String(service?.PublicCode ?? service?.TrainNumber ?? '').replace(category, '').trim()
      || String(service?.TrainNumber ?? '');
    return {
      departure: {
        station: { name: textOf(board?.StopPointName) },
        departure: board?.ServiceDeparture?.EstimatedTime ?? board?.ServiceDeparture?.TimetabledTime,
        platform: platformOf(board),
      },
      arrival: {
        station: { name: textOf(alight?.StopPointName) },
        arrival: alight?.ServiceArrival?.EstimatedTime ?? alight?.ServiceArrival?.TimetabledTime,
        platform: platformOf(alight),
      },
      journey: {
        name: `${category} ${number}`.trim(),
        category,
        number,
        to: textOf(service?.DestinationText),
        passList: buildPassList(leg.TimedLeg, placesLookup),
      },
    };
  }
  if (leg.TransferLeg) {
    return { walk: { duration: isoDurationToSeconds(leg.TransferLeg.Duration ?? leg.Duration) } };
  }
  return null;
}

function mapTripResult(tripResult, placesLookup) {
  const trip = tripResult.Trip;
  const legs = trip.Leg ?? [];
  const sections = legs.map(leg => mapLeg(leg, placesLookup)).filter(Boolean);
  const timedLegs = legs.map(l => l.TimedLeg).filter(Boolean);
  const products = [...new Set(timedLegs.map(tl => textOf(tl.Service?.ProductCategory?.ShortName)).filter(Boolean))];

  return {
    from: {
      departure: trip.StartTime,
      station: { name: textOf(timedLegs[0]?.LegBoard?.StopPointName) },
    },
    to: {
      arrival: trip.EndTime,
      station: { name: textOf(timedLegs[timedLegs.length - 1]?.LegAlight?.StopPointName) },
    },
    duration: secondsToDurationString(isoDurationToSeconds(trip.Duration)),
    transfers: Number(trip.Transfers ?? 0),
    products,
    sections,
  };
}

/**
 * Maps an OJPTripDelivery response into the same shape `transport.js`'s controllers already
 * returned from transport.opendata.ch's `/connections` (see `ConnectionResult` in
 * `shared/services/transport.ts`) — a trip result with no legs at all (malformed/empty) is
 * dropped rather than trusted, same defensive stance as `parseLocationInformationResponse`.
 */
export function parseTripResponse(xml) {
  const parsed = xmlParser.parse(xml);
  const delivery = parsed?.OJP?.OJPResponse?.['siri:ServiceDelivery']?.OJPTripDelivery;
  const placesLookup = buildPlacesLookup(delivery?.TripResponseContext?.Places?.Place);
  const results = delivery?.TripResult ?? [];
  return results
    .map(result => mapTripResult(result, placesLookup))
    .filter(connection => connection.sections.length > 0);
}

function mapPlace(place) {
  if (!place) return null;
  const lat = place.GeoPosition?.['siri:Latitude'];
  const lon = place.GeoPosition?.['siri:Longitude'];
  if (lat == null || lon == null) return null;

  const genericName = textOf(place.Name);
  const coordinate = { x: Number(lat), y: Number(lon) };

  if (place.StopPlace) {
    const name = textOf(place.StopPlace.StopPlaceName) || genericName;
    return { id: place.StopPlace.StopPlaceRef ?? '', name, type: 'station', coordinate, modes: extractModes(place.Mode) };
  }
  if (place.TopographicPlace) {
    const name = textOf(place.TopographicPlace.TopographicPlaceName) || genericName;
    const id = place.TopographicPlace.TopographicPlaceCode ?? `topo:${lat},${lon}`;
    return { id, name, type: 'address', coordinate, modes: [] };
  }
  if (place.Address) {
    const id = place.Address.PublicCode ?? `addr:${lat},${lon}`;
    return { id, name: genericName, type: 'address', coordinate, modes: [] };
  }
  return null;
}
