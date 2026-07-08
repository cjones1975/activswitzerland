import axios from 'axios';
import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../middleware/async.js';

const GEOADMIN_IDENTIFY_URL = 'https://api3.geo.admin.ch/rest/services/all/MapServer/identify';

// ch.astra.wanderland = official SchweizMobil hiking routes (Wanderland)
// Swap for ch.astra.veloland / ch.astra.mountainbikeland for cycling/MTB.
const HIKING_LAYER = 'ch.astra.wanderland';

const SUPPORTED_LANGS = ['de', 'fr', 'it', 'en'];

// SchweizMobil convention: 1-digit route number = national, 2-digit = regional,
// 3+ digit = local. Applies across Wanderland/Veloland/Mountainbikeland/Skatingland.
function getRouteCategory(routeNumber) {
    const digits = String(routeNumber).length;
    if (digits === 1) return 'national';
    if (digits === 2) return 'regional';
    return 'local';
}

// @desc    GET hiking routes near a point
// @route   GET /api/v1/hikes
// @access  Public
export const getHikes = asyncHandler(async (req, res, next) => {
    const { easting, northing } = req.lv95;
    const radiusMeters = parseInt(req.query.radius, 10) || 30000;
    const langParam = SUPPORTED_LANGS.includes(req.query.lang) ? req.query.lang : 'en';

    const config = {
        method: 'get',
        url: GEOADMIN_IDENTIFY_URL,
        params: {
            geometry: `${easting},${northing}`,
            geometryType: 'esriGeometryPoint',
            layers: `all:${HIKING_LAYER}`,
            mapExtent: '0,0,100,100',
            imageDisplay: '100,100,100',
            tolerance: radiusMeters,
            returnGeometry: true,
            geometryFormat: 'geojson',
            sr: 2056,
            lang: langParam,
        },
    };

    try {
        const response = await axios(config);

        if (!response.data) {
            return next(new ErrorResponse(`No hiking route data found`, 404));
        }

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
                    properties: feature.properties,
                    stages: [],
                });
            }

            routesByNumber.get(routeNumber).stages.push({
                stageId: feature.id,
                geometry: feature.geometry, // LineString in LV95; reproject on the frontend if needed for mapping
            });
        }

        const hikes = Array.from(routesByNumber.values());

        res.status(200).json({ success: true, count: hikes.length, radiusMeters, data: hikes });
    } catch (error) {
        console.error(error);
        next(
            new ErrorResponse(`An error occurred during the request: ${error.message}`, 500)
        );
    }
});
