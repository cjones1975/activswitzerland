import { searchDestinationsByName, fetchDestinationById, fetchAttractionsForPlace } from './myswitzerland.js';
import { fetchWeatherForecast } from './weather.js';
import { searchSchweizMobilRoutes } from './schweizMobilRoutes.js';
import { fetchConnections } from './ojp.js';

const HIKING_LAYER = 'ch.astra.wanderland';
const BIKE_LAYERS = { road: 'ch.astra.veloland', mountain: 'ch.astra.mountainbikeland' };

// Tools whose result is worth showing as a card in the chat UI, not just narrated in text —
// `aiAgent.js`'s runConversation() tracks these tool_use calls and attaches their raw results as
// `cards` on the final response. See the "cards extraction" note in the spec.
export const PRESENTABLE_TOOLS = new Set(['search_hikes', 'search_bikes', 'get_weather', 'get_destination_info', 'get_transit_connections']);

// Full tool results (raw Open-Meteo hourly+daily arrays, full route geometry with hundreds of
// GPS points) are needed by the frontend cards, but are needless bulk for the model — and, worse,
// invite it to transcribe exact dates/temperatures/distances from a huge array into prose, which
// it does unreliably (confirmed live: asked for weather, replied with every date shifted by one
// day against the real forecast). These trim what the model actually reads to a lean, harder-to-
// misread shape; the untrimmed `result` is still what becomes the card.
const MODEL_SUMMARIZERS = {
  get_weather(result) {
    const d = result?.daily;
    if (!d) return result;
    return {
      timezone: result.timezone,
      days: d.time.map((date, i) => ({
        date,
        maxTemp: d.temperature_2m_max[i],
        minTemp: d.temperature_2m_min[i],
        precipitationMm: d.precipitation_sum?.[i],
      })),
    };
  },
  search_hikes: summarizeRoutes,
  search_bikes: summarizeRoutes,
  get_destination_info(result) {
    return {
      destination: result?.destination
        ? { id: result.destination.identifier, name: result.destination.name, abstract: result.destination.abstract }
        : null,
      attractions: (result?.attractions ?? []).map(a => ({ id: a.identifier, name: a.name, abstract: a.abstract })),
    };
  },
  get_transit_connections: summarizeConnections,
};

const ZURICH_TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Zurich', hourCycle: 'h23', hour: '2-digit', minute: '2-digit',
});

// OJP times are UTC ISO strings (e.g. "2026-08-21T09:35:48Z" for an 11:35 CEST departure) — handed
// to the model as-is, it just reads the UTC hour off the string as if it were already local time
// (confirmed live: asked to find a 12:05 departure, replied "the ones I have are around 09:35 and
// 10:05" — the *UTC* clock-times of what were really 11:35/12:05 Zurich departures. It can't do
// the +1/+2h DST conversion reliably any more than it can transcribe a long list correctly, so the
// fix is the same as elsewhere: hand it the already-correct wall-clock time, not raw data to convert.
function toZurichTime(iso) {
  if (!iso) return iso;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : ZURICH_TIME_FORMAT.format(d);
}

// parseTripResponse's real shape (ojp.js's mapTripResult) is
// { from: { departure, station: { name } }, to: { arrival, station: { name } }, duration,
//   transfers, products, sections } — flattened here to { from, to, departure, arrival, duration,
// transfers } (station names, not objects; departure/arrival as Zurich local "HH:mm", not raw UTC)
// since neither the model nor the chat card needs the per-stop `sections` detail or the full route
// polyline; this is the same lean shape both consume (no separate connections drawer exists to
// open with untrimmed data, unlike the other cards).
function summarizeConnections(result) {
  if (!Array.isArray(result)) return result;
  return result.slice(0, 3).map(c => ({
    from: c.from?.station?.name,
    to: c.to?.station?.name,
    departure: toZurichTime(c.from?.departure),
    arrival: toZurichTime(c.to?.arrival),
    duration: c.duration,
    transfers: c.transfers,
  }));
}

function summarizeRoutes(result) {
  if (!Array.isArray(result)) return result;
  return result.map(({ routeNumber, name, category, distanceKm, isMultiDay, totalStages }) => (
    { routeNumber, name, category, distanceKm, isMultiDay, totalStages }
  ));
}

export function summarizeForModel(toolName, result) {
  const summarize = MODEL_SUMMARIZERS[toolName];
  return summarize ? summarize(result) : result;
}

// Plain JSON Schema tool definitions, same style as translate.js's TRANSLATION_SCHEMA.
// `strict: true` (+ `additionalProperties: false` on every schema) makes the API itself validate
// the model's tool call against the schema before it ever reaches a handler — without it, nothing
// actually guarantees a "required" field is present (confirmed: the weather card's drawer link
// failed downstream because a get_weather call produced no reliable evidence its lat/lon were
// ever enforced — this closes that gap rather than hoping the model always complies).
export const AI_TOOLS = [
  {
    name: 'resolve_location',
    description: 'Resolve a free-text Swiss place name (e.g. "Zermatt", "Bern") to its id and coordinates. Call this first whenever a place name appears in the conversation and its coordinates/id aren\'t already known from context or an earlier tool result.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The place name as the user wrote it.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_destination_info',
    description: 'Get a Swiss destination\'s description and a short list of things to do there (attractions).',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        destinationId: { type: 'string', description: 'A destination id, from resolve_location.' },
      },
      required: ['destinationId'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_weather',
    description: '7-day weather forecast for a specific location.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        lat: { type: 'number' },
        lon: { type: 'number' },
      },
      required: ['lat', 'lon'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_hikes',
    description: 'Search official SchweizMobil hiking trails by name or area. Results include each trail\'s distance and difficulty category — filter/recommend from the results rather than assuming distance.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Trail name or area, e.g. "Lauterbrunnen".' },
        lang: { type: 'string', description: 'Two-letter UI language code (en/de/fr/it/es). Falls back to English results server-side if the underlying route data has no Spanish.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_bikes',
    description: 'Search official SchweizMobil cycling routes by name or area.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        lang: { type: 'string' },
        bikeType: { type: 'string', enum: ['road', 'mountain'] },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_transit_connections',
    description: 'Find Swiss public transport (train/bus) connections between two named stations.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Departure station name.' },
        to: { type: 'string', description: 'Arrival station name.' },
        date: { type: 'string', description: 'YYYY-MM-DD. Defaults to today if omitted.' },
        time: { type: 'string', description: 'HH:mm, 24h. Defaults to now if omitted.' },
      },
      required: ['from', 'to'],
      additionalProperties: false,
    },
  },
];

export const AI_TOOL_HANDLERS = {
  async resolve_location({ query }) {
    return searchDestinationsByName(query);
  },
  async get_destination_info({ destinationId }) {
    const [destination, attractions] = await Promise.all([
      fetchDestinationById(destinationId),
      fetchAttractionsForPlace(destinationId),
    ]);
    return { destination, attractions };
  },
  async get_weather({ lat, lon }) {
    return fetchWeatherForecast({ lat, lon });
  },
  async search_hikes({ query, lang }) {
    return searchSchweizMobilRoutes({ layer: HIKING_LAYER, query, lang });
  },
  async search_bikes({ query, lang, bikeType }) {
    const layer = BIKE_LAYERS[bikeType === 'mountain' ? 'mountain' : 'road'];
    return searchSchweizMobilRoutes({ layer, query, lang });
  },
  async get_transit_connections({ from, to, date, time }) {
    return fetchConnections({ from, to, date, time });
  },
};
