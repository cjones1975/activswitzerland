import { XMLParser } from 'fast-xml-parser';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: name => name === 'PlaceResult' || name === 'Mode',
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
