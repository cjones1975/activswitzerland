import { XMLParser } from 'fast-xml-parser';
import Hike from '../models/Hike.js';
import { reprojectToLv95, linesDistanceMeters } from './schweizMobilRoutes.js';

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

// Same noise floor as fetchElevationProfile in schweizMobilRoutes.js - summing every raw
// trackpoint-to-trackpoint delta wildly overcounts gain/loss from GPS/DEM noise.
const ELEVATION_NOISE_THRESHOLD_M = 0.5;

function asArray(value) {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
}

function parsePoint(pt) {
    return [parseFloat(pt.lon), parseFloat(pt.lat), pt.ele != null ? parseFloat(pt.ele) : null];
}

// Parses a GPX document into everything a Hike document needs: one MultiLineString stage (every
// <trkseg> becomes its own line - the ASTRA convention for a route with gaps, see getLines in
// schweizMobilRoutes.js), distance (LV95, same math as ASTRA routes), elevation stats computed
// directly from the GPX's own <ele> values (no geo.admin.ch DEM call - faster, and works outside
// Switzerland too), and the first/last named waypoints as start/end points if present.
export function parseGpx(gpxString) {
    let doc;
    try {
        doc = xmlParser.parse(gpxString);
    } catch {
        throw new Error('Could not parse GPX file');
    }

    const gpx = doc?.gpx;
    if (!gpx) throw new Error('Not a valid GPX file');

    const lines = [];
    for (const trk of asArray(gpx.trk)) {
        for (const seg of asArray(trk.trkseg)) {
            const points = asArray(seg.trkpt).map(parsePoint);
            if (points.length >= 2) lines.push(points);
        }
    }
    if (!lines.length) throw new Error('GPX file has no usable track segments');

    const lv95Lines = lines.map(line => line.map(([lon, lat]) => reprojectToLv95([lon, lat])));
    const distanceKm = linesDistanceMeters(lv95Lines) / 1000;

    let ascentM = 0, descentM = 0, baseElevation = null;
    let minElevation = Infinity, maxElevation = -Infinity, elevationSamples = 0;
    for (const line of lines) {
        for (const [, , ele] of line) {
            if (ele == null) continue;
            elevationSamples++;
            minElevation = Math.min(minElevation, ele);
            maxElevation = Math.max(maxElevation, ele);
            if (baseElevation == null) {
                baseElevation = ele;
            } else {
                const diff = ele - baseElevation;
                if (Math.abs(diff) >= ELEVATION_NOISE_THRESHOLD_M) {
                    if (diff > 0) ascentM += diff; else descentM += -diff;
                    baseElevation = ele;
                }
            }
        }
    }
    const hasElevation = elevationSamples > 0;
    const round1 = n => Math.round(n * 10) / 10;

    const waypoints = asArray(gpx.wpt).map(w => ({
        name: w.name ?? null,
        lat: parseFloat(w.lat),
        lon: parseFloat(w.lon),
        elevation: w.ele != null ? parseFloat(w.ele) : null,
    }));

    return {
        stage: {
            stageId: '1',
            stageNumber: 1,
            title: '',
            geometry: { type: 'MultiLineString', coordinates: lv95Lines },
            geometryWgs84: { type: 'MultiLineString', coordinates: lines.map(line => line.map(([lon, lat]) => [lon, lat])) },
        },
        distanceKm,
        distanceMiles: distanceKm * 0.621371,
        ascentM: hasElevation ? round1(ascentM) : undefined,
        descentM: hasElevation ? round1(descentM) : undefined,
        minElevation: hasElevation ? round1(minElevation) : undefined,
        maxElevation: hasElevation ? round1(maxElevation) : undefined,
        startPoint: waypoints[0] ?? undefined,
        endPoint: waypoints.length > 1 ? waypoints[waypoints.length - 1] : undefined,
        pointCount: lines.reduce((sum, l) => sum + l.length, 0),
        segmentCount: lines.length,
    };
}

function slugify(name) {
    return String(name)
        .toLowerCase()
        .normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
}

// A random suffix makes a collision astronomically unlikely, which is simpler than a
// DB-checking retry loop (compare Trip's generateUniqueSlug) for what's a low-frequency,
// single-admin write path.
export function generateRouteNumber(name) {
    const suffix = Math.random().toString(16).slice(2, 8);
    return `custom-${slugify(name) || 'hike'}-${suffix}`;
}

function hikeToTrailRoute(hike) {
    return {
        routeNumber: hike.routeNumber,
        name: hike.name,
        category: hike.category,
        isMultiDay: hike.isMultiDay,
        distanceKm: hike.distanceKm,
        distanceMiles: hike.distanceMiles,
        source: hike.source,
        stages: hike.stages,
    };
}

function minDistanceToPointMeters(lines, easting, northing) {
    let min = Infinity;
    for (const line of lines) {
        for (const [x, y] of line) {
            const d = Math.hypot(x - easting, y - northing);
            if (d < min) min = d;
        }
    }
    return min;
}

// Vertex-nearest-distance, not true point-to-segment distance - deliberate simplification. A
// digitized hike track has hundreds of closely-spaced vertices, so the error this introduces is
// negligible next to a many-km search radius. Revisit if the collection grows large enough that
// an in-memory scan (rather than a geospatial index) stops being fast enough - not expected any
// time soon for a manually-curated, admin-added list.
export async function fetchCustomHikesNear({ easting, northing, radiusMeters }) {
    const hikes = await Hike.find();
    return hikes
        .filter(hike => {
            const lines = hike.stages.flatMap(s => s.geometry.coordinates);
            return minDistanceToPointMeters(lines, easting, northing) <= radiusMeters;
        })
        .map(hikeToTrailRoute);
}

export async function searchCustomHikes(query) {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hikes = await Hike.find({ name: new RegExp(escaped, 'i') });
    return hikes.map(hikeToTrailRoute);
}
