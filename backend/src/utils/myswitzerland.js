import axios from 'axios';

// Standalone, tool-appropriate MySwitzerland calls for the AI chat agent — deliberately not a
// refactor of controllers/myswitzerland.js's existing endpoints (those pass through page/
// hitsPerPage/translate/facets params the frontend already depends on; touching their behavior
// isn't worth the risk for what the AI tool actually needs: a name → id/geo lookup, a single
// destination by id, and a short attractions list). Same MYS_ENDPOINT/MYS_KEY, same
// invalid-geo filtering as the controller's `stripInvalidGeo` — the AI shouldn't be handed a
// destination it can't then look up weather/hikes for.
const hasValidGeo = (record) => {
  const lat = Number(record?.geo?.latitude);
  const lon = Number(record?.geo?.longitude);
  return !Number.isNaN(lat) && !Number.isNaN(lon) && lat !== 0 && lon !== 0;
};

function mysConfig(path, params) {
  return {
    method: 'get',
    url: `${process.env.MYS_ENDPOINT}${path}`,
    params,
    headers: {
      'x-api-key': process.env.MYS_KEY,
      accept: 'application/json',
    },
  };
}

// Resolves a free-text place name ("Zermatt") to the handful of best-matching destinations,
// each carrying id + geo — the AI's linchpin call, since every other tool needs coordinates or
// an id, not a name.
export async function searchDestinationsByName(query, lang = 'en') {
  const response = await axios(mysConfig('/v1/destinations/', {
    lang, query, hitsPerPage: 5, expand: true, striphtml: true,
  }));
  const data = (response.data?.data ?? []).filter(hasValidGeo);
  return data.map(d => ({
    id: d.identifier, name: d.name, geo: d.geo, abstract: d.abstract,
  }));
}

export async function fetchDestinationById(id, lang = 'en') {
  const response = await axios(mysConfig(`/v1/destinations/${id}`, {
    lang, expand: true, striphtml: true,
  }));
  return response.data?.data ?? null;
}

// Full raw attraction records (same shape frontend/src/app/models/attraction.ts's `Attraction`
// expects) — trimmed down for the model's own reading in aiTools.js's summarizeForModel, not here,
// so the untrimmed result stays available if a future card needs to open the real attraction-detail
// drawer.
export async function fetchAttractionsForPlace(placeId, lang = 'en') {
  const response = await axios(mysConfig('/v1/attractions/', {
    lang, placeId, hitsPerPage: 8, expand: true, striphtml: true,
  }));
  return (response.data?.data ?? []).filter(hasValidGeo);
}
