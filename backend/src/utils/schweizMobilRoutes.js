import axios from 'axios';
import proj4 from 'proj4';

const GEOADMIN_IDENTIFY_URL = 'https://api3.geo.admin.ch/rest/services/all/MapServer/identify';
const GEOADMIN_FIND_URL = 'https://api3.geo.admin.ch/rest/services/all/MapServer/find';
const GEOADMIN_PROFILE_URL = 'https://api3.geo.admin.ch/rest/services/profile.json';

// Cap points-per-line so the payload doesn't grow unbounded on very long
// multi-stage routes, while staying dense enough for a smooth chart. Note:
// geo.admin.ch only resamples DOWN to this count - if the source line already
// has more vertices than nb_points (common for a long digitized trail), it
// returns one DEM sample per original vertex instead, which is why ascent/
// descent needs a noise floor (see ELEVATION_NOISE_THRESHOLD_M below).
const PROFILE_NB_POINTS = 150;

// Minimum elevation change (meters) before a climb/descent counts toward
// ascent/descent. Summing every raw delta between densely-sampled DEM points
// wildly overcounts gain/loss from terrain-model noise (confirmed against
// SchweizMobil's published figures for a reference route: naive summation
// read ~7% high). This hysteresis approach - only counting a move once it
// clears the noise floor, then resetting the baseline - is the same principle
// GPS fitness platforms use for elevation gain.
const ELEVATION_NOISE_THRESHOLD_M = 0.5;

// WGS84 <-> LV95 (Swiss CH1903+ projection). This towgs84 approximation is
// accurate to ~1-2m, more than enough for route geometry.
proj4.defs(
    'EPSG:2056',
    '+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 ' +
    '+k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel ' +
    '+towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs'
);

const SUPPORTED_LANGS = ['de', 'fr', 'it', 'en'];

// SchweizMobil convention: 1-digit route number = national, 2-digit = regional,
// 3+ digit = local. Applies across Wanderland/Veloland/Mountainbikeland/Skatingland.
export function getRouteCategory(routeNumber) {
    const digits = String(routeNumber).length;
    if (digits === 1) return 'national';
    if (digits === 2) return 'regional';
    return 'local';
}

function reprojectCoord([easting, northing]) {
    return proj4('EPSG:2056', 'EPSG:4326', [easting, northing]);
}

// geo.admin.ch returns LineString for simple stages but MultiLineString for
// stages with a gap/discontinuity. Normalize both to an array of lines
// (array of [x,y] arrays) so downstream code has one shape to deal with.
function getLines(geometry) {
    if (!geometry) return [];
    if (geometry.type === 'LineString') return [geometry.coordinates];
    if (geometry.type === 'MultiLineString') return geometry.coordinates;
    return [];
}

function reprojectGeometry(geometry) {
    const lines = getLines(geometry);
    return { type: 'MultiLineString', coordinates: lines.map(line => line.map(reprojectCoord)) };
}

// Geometry is already in LV95 meters, so summing Euclidean distance between
// consecutive vertices gives trail length directly, no reprojection needed.
function linesDistanceMeters(lines) {
    let meters = 0;
    for (const line of lines) {
        for (let i = 1; i < line.length; i++) {
            const [x1, y1] = line[i - 1];
            const [x2, y2] = line[i];
            meters += Math.hypot(x2 - x1, y2 - y1);
        }
    }
    return meters;
}

// Fetches routes from a SchweizMobil geo.admin.ch layer (Wanderland/Veloland/...)
// near a point, grouping stage/segment features back into whole routes.
export async function fetchSchweizMobilRoutes({ layer, easting, northing, radiusMeters, lang }) {
    const langParam = SUPPORTED_LANGS.includes(lang) ? lang : 'en';

    const response = await axios({
        method: 'get',
        url: GEOADMIN_IDENTIFY_URL,
        params: {
            geometry: `${easting},${northing}`,
            geometryType: 'esriGeometryPoint',
            layers: `all:${layer}`,
            mapExtent: '0,0,100,100',
            imageDisplay: '100,100,100',
            tolerance: radiusMeters,
            returnGeometry: true,
            geometryFormat: 'geojson',
            sr: 2056,
            lang: langParam,
        },
    });

    if (!response.data) return [];

    // Individual results are stage/segment features, not whole routes.
    // id format is "{routeNumber}.{stageNumber}", e.g. "6.18" = stage 18
    // of route 6. Group them back into their parent route here so the
    // frontend gets one card per route, not one per stage.
    const routesByNumber = new Map();

    for (const feature of response.data.results || []) {
        const routeNumber = feature.properties?.chmobil_route_number;

        if (!routesByNumber.has(routeNumber)) {
            routesByNumber.set(routeNumber, {
                routeNumber,
                name: feature.properties?.chmobil_title || `Route ${routeNumber}`,
                category: getRouteCategory(routeNumber),
                // chmobil_has_segment: true means this route is one stage of a
                // longer multi-day route; false means it's a complete standalone
                // route. Assumed consistent across all of a route's stages, so
                // only the first feature seen for this route number is captured.
                hasSegment: feature.properties?.chmobil_has_segment,
                properties: feature.properties,
                stages: [],
            });
        }

        routesByNumber.get(routeNumber).stages.push({
            stageId: feature.id,
            stageNumber: parseStageNumber(feature.id),
            title: feature.properties?.chmobil_title || '',
            // Normalized to MultiLineString, LV95 meters.
            geometry: { type: 'MultiLineString', coordinates: getLines(feature.geometry) },
        });
    }

    const routes = Array.from(routesByNumber.values());

    // Nearby-search results only see the stages that fall within the search
    // radius, not the whole route - so the "Stage 9 of 20" badge needs a
    // separate, lightweight (attributes-only, no geometry) nationwide count
    // per multi-day route. Fetched in parallel, best-effort: a failure here
    // just means that route's badge omits the "of N" suffix.
    const totalStagesByRoute = new Map();
    await Promise.all(
        routes.filter(route => route.hasSegment).map(async route => {
            try {
                totalStagesByRoute.set(route.routeNumber, await fetchStageCount({
                    layer, routeNumber: route.routeNumber, lang: langParam,
                }));
            } catch (error) {
                console.error(`Stage count failed for route ${route.routeNumber}: ${error.message}`);
            }
        })
    );

    return routes.map(route => {
        const distanceMeters = route.stages.reduce(
            (sum, stage) => sum + linesDistanceMeters(stage.geometry.coordinates),
            0
        );
        const distanceKm = distanceMeters / 1000;

        return {
            routeNumber: route.routeNumber,
            name: route.name,
            category: route.category,
            isMultiDay: !!route.hasSegment,
            totalStages: totalStagesByRoute.get(route.routeNumber),
            distanceKm,
            distanceMiles: distanceKm * 0.621371,
            stages: route.stages.map(stage => ({
                ...stage,
                geometryWgs84: reprojectGeometry(stage.geometry),
            })),
        };
    });
}

// Attributes-only (no geometry) count of how many stages a route has
// nationwide - used for the "Stage 9 of 20" badge total, without paying for
// the full geometry payload fetchRouteStages needs.
async function fetchStageCount({ layer, routeNumber, lang }) {
    const response = await axios({
        method: 'get',
        url: GEOADMIN_FIND_URL,
        params: {
            layer,
            searchField: 'chmobil_route_number',
            searchText: routeNumber,
            contains: false,
            returnGeometry: false,
            lang,
        },
    });

    return response.data?.results?.length ?? undefined;
}

// id format is "{routeNumber}.{stageNumber}", e.g. "6.18" = stage 18 of route 6.
function parseStageNumber(featureId) {
    return parseInt(String(featureId).split('.')[1], 10);
}

// The raw chmobil_title always includes a "(From - To)" leg suffix, which
// reads redundantly at the route level once stage progress is already shown
// separately (e.g. "Stage 9 of 20") - stripped here for the route-level name,
// left intact on each stage's own title.
function stripStageSuffix(title) {
    return String(title ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

// Fetches every stage of a multi-day route nationwide (not radius-limited),
// via geo.admin.ch's "find" service (search by attribute value across the
// whole layer) rather than the radius-bound "identify" service used by
// fetchSchweizMobilRoutes above. find requires two calls to get both
// attributes and geometry: returnGeometry=false returns attributes but no
// geometry, returnGeometry=true returns geometry but no attributes at all -
// the two result sets are merged here by feature id.
export async function fetchRouteStages({ layer, routeNumber, lang }) {
    const langParam = SUPPORTED_LANGS.includes(lang) ? lang : 'en';

    const findParams = {
        layer,
        searchField: 'chmobil_route_number',
        searchText: routeNumber,
        contains: false,
    };

    const [attributesRes, geometryRes] = await Promise.all([
        axios({
            method: 'get',
            url: GEOADMIN_FIND_URL,
            params: { ...findParams, returnGeometry: false, lang: langParam },
        }),
        axios({
            method: 'get',
            url: GEOADMIN_FIND_URL,
            params: { ...findParams, returnGeometry: true, sr: 2056, geometryFormat: 'geojson' },
        }),
    ]);

    const attributesByKey = new Map();
    for (const feature of attributesRes.data?.results || []) {
        const key = feature.id ?? feature.featureId;
        attributesByKey.set(key, feature.attributes ?? feature.properties ?? {});
    }

    const geometryByKey = new Map();
    for (const feature of geometryRes.data?.results || []) {
        const key = feature.id ?? feature.featureId;
        geometryByKey.set(key, feature.geometry);
    }

    const stages = [];
    for (const [key, attrs] of attributesByKey) {
        const geometry = geometryByKey.get(key);
        if (!geometry) continue;

        stages.push({
            stageId: key,
            stageNumber: parseStageNumber(key),
            title: attrs.chmobil_title || '',
            hasSegment: attrs.chmobil_has_segment,
            geometry: { type: 'MultiLineString', coordinates: getLines(geometry) },
        });
    }

    if (!stages.length) return null;

    stages.sort((a, b) => a.stageNumber - b.stageNumber);

    const distanceMeters = stages.reduce(
        (sum, stage) => sum + linesDistanceMeters(stage.geometry.coordinates),
        0
    );
    const distanceKm = distanceMeters / 1000;

    return {
        routeNumber,
        name: stripStageSuffix(stages[0].title),
        category: getRouteCategory(routeNumber),
        isMultiDay: !!stages[0].hasSegment,
        distanceKm,
        distanceMiles: distanceKm * 0.621371,
        stages: stages.map(({ hasSegment, ...stage }) => ({
            ...stage,
            geometryWgs84: reprojectGeometry(stage.geometry),
        })),
    };
}

function escapeXml(value) {
    return String(value ?? '').replace(/[<>&'"]/g, char => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
    }[char]));
}

// Builds a GPX document from a route's stages (LV95 geometries), inverse-projecting
// each vertex back to WGS84. Each line within a stage becomes its own <trkseg>.
export function buildGpx({ name, stages }) {
    const trackSegments = (stages ?? [])
        .flatMap(stage => getLines(stage.geometry))
        .map(line => {
            const points = line
                .map(coord => {
                    const [lon, lat] = reprojectCoord(coord);
                    return `      <trkpt lat="${lat}" lon="${lon}"></trkpt>`;
                })
                .join('\n');
            return `    <trkseg>\n${points}\n    </trkseg>`;
        })
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ActivSwitzerland" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${escapeXml(name || 'Route')}</name>
${trackSegments}
  </trk>
</gpx>`;
}

// Queries geo.admin.ch's DEM profile service for one line's elevation samples
// (LV95 meters in, {dist, alts} samples out - dist is cumulative meters along
// this line only, so callers must re-base it against a running total).
async function fetchLineProfile(line) {
    const response = await axios({
        method: 'post',
        url: GEOADMIN_PROFILE_URL,
        params: { sr: 2056, nb_points: PROFILE_NB_POINTS },
        // geo.admin.ch rejects axios' default "application/x-www-form-urlencoded;charset=utf-8"
        // with a 415, so the header is set explicitly without a charset.
        data: `geom=${encodeURIComponent(JSON.stringify({ type: 'LineString', coordinates: line }))}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    return response.data || [];
}

// Builds a distance-vs-elevation profile for a whole route (all stages, all
// lines within each stage), querying profile.json per line and concatenating
// results with a running distance offset so the combined profile has one
// continuous distance axis. A route's stages can be disconnected, so the
// offset carries across a stage boundary the same way distanceKm's per-line
// summation already does - the distance axis can show a false "seam" at a gap,
// an accepted limitation rather than something this function corrects.
export async function fetchElevationProfile(stages) {
    const lines = (stages ?? []).flatMap(stage => getLines(stage.geometry)).filter(line => line.length >= 2);

    let distanceOffsetMeters = 0;
    let baseElevation = null;
    let ascentM = 0;
    let descentM = 0;
    const points = [];

    for (const line of lines) {
        const samples = await fetchLineProfile(line);
        let lineMaxDist = 0;

        for (const sample of samples) {
            const elevation = sample.alts?.COMB ?? sample.alts?.DTM25;
            if (elevation == null) continue;

            const dist = sample.dist ?? 0;
            lineMaxDist = Math.max(lineMaxDist, dist);
            points.push({ distanceKm: (distanceOffsetMeters + dist) / 1000, elevation });

            if (baseElevation == null) {
                baseElevation = elevation;
            } else {
                const diff = elevation - baseElevation;
                if (Math.abs(diff) >= ELEVATION_NOISE_THRESHOLD_M) {
                    if (diff > 0) ascentM += diff;
                    else descentM += -diff;
                    baseElevation = elevation;
                }
            }
        }

        distanceOffsetMeters += lineMaxDist;
    }

    if (points.length < 2) return null;

    const elevations = points.map(p => p.elevation);
    const round2 = n => Math.round(n * 100) / 100;

    return {
        points,
        ascentM: round2(ascentM),
        descentM: round2(descentM),
        minElevation: round2(Math.min(...elevations)),
        maxElevation: round2(Math.max(...elevations)),
    };
}
