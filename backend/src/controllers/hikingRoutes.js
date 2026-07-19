import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../middleware/async.js';
import { fetchSchweizMobilRoutes, buildGpx, fetchElevationProfile, fetchRouteStages } from '../utils/schweizMobilRoutes.js';

// ch.astra.wanderland = official SchweizMobil hiking routes (Wanderland)
const HIKING_LAYER = 'ch.astra.wanderland';

// @desc    GET hiking routes near a point
// @route   GET /api/v1/hikes
// @access  Public
export const getHikes = asyncHandler(async (req, res, next) => {
    const { easting, northing } = req.lv95;
    const radiusMeters = parseInt(req.query.radius, 10) || 30000;

    try {
        const hikes = await fetchSchweizMobilRoutes({
            layer: HIKING_LAYER,
            easting,
            northing,
            radiusMeters,
            lang: req.query.lang,
        });

        res.status(200).json({ success: true, count: hikes.length, radiusMeters, data: hikes });
    } catch (error) {
        console.error(error);
        next(
            new ErrorResponse(`An error occurred during the request: ${error.message}`, 500)
        );
    }
});

// @desc    Export a hiking route as a GPX file
// @route   POST /api/v1/hikes/gpx
// @access  Public
export const getHikesGpx = asyncHandler(async (req, res, next) => {
    const { name, stages } = req.body;

    if (!Array.isArray(stages) || !stages.length) {
        return next(new ErrorResponse('stages array is required', 400));
    }

    const gpx = buildGpx({ name, stages });
    const filename = `${String(name || 'route').replace(/[^a-z0-9\-_]+/gi, '_')}.gpx`;

    res
        .status(200)
        .set('Content-Type', 'application/gpx+xml')
        .set('Content-Disposition', `attachment; filename="${filename}"`)
        .send(gpx);
});

// @desc    Elevation profile (distance vs elevation, ascent/descent) for a hiking route
// @route   POST /api/v1/hikes/elevation
// @access  Public
export const getHikesElevation = asyncHandler(async (req, res, next) => {
    const { stages } = req.body;

    if (!Array.isArray(stages) || !stages.length) {
        return next(new ErrorResponse('stages array is required', 400));
    }

    try {
        const profile = await fetchElevationProfile(stages);

        if (!profile) {
            return next(new ErrorResponse('Elevation profile unavailable for this route', 404));
        }

        res.status(200).json({ success: true, data: profile });
    } catch (error) {
        console.error(error);
        next(
            new ErrorResponse(`An error occurred during the request: ${error.message}`, 500)
        );
    }
});

// @desc    All stages of a multi-day hiking route, nationwide (not radius-limited)
// @route   GET /api/v1/hikes/:routeNumber/stages
// @access  Public
export const getHikeStages = asyncHandler(async (req, res, next) => {
    const { routeNumber } = req.params;

    try {
        const route = await fetchRouteStages({ layer: HIKING_LAYER, routeNumber, lang: req.query.lang });

        if (!route) {
            return next(new ErrorResponse(`No stages found for route ${routeNumber}`, 404));
        }

        res.status(200).json({ success: true, data: route });
    } catch (error) {
        console.error(error);
        next(
            new ErrorResponse(`An error occurred during the request: ${error.message}`, 500)
        );
    }
});
