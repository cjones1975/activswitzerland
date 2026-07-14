import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../middleware/async.js';
import { fetchSchweizMobilRoutes, buildGpx, fetchElevationProfile } from '../utils/schweizMobilRoutes.js';

// ch.astra.veloland = official SchweizMobil bike routes (Veloland)
const BIKE_LAYER = 'ch.astra.veloland';

// @desc    GET bike routes near a point
// @route   GET /api/v1/bikes
// @access  Public
export const getBikes = asyncHandler(async (req, res, next) => {
    const { easting, northing } = req.lv95;
    const radiusMeters = parseInt(req.query.radius, 10) || 30000;

    try {
        const bikes = await fetchSchweizMobilRoutes({
            layer: BIKE_LAYER,
            easting,
            northing,
            radiusMeters,
            lang: req.query.lang,
        });

        res.status(200).json({ success: true, count: bikes.length, radiusMeters, data: bikes });
    } catch (error) {
        console.error(error);
        next(
            new ErrorResponse(`An error occurred during the request: ${error.message}`, 500)
        );
    }
});

// @desc    Export a bike route as a GPX file
// @route   POST /api/v1/bikes/gpx
// @access  Public
export const getBikesGpx = asyncHandler(async (req, res, next) => {
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

// @desc    Elevation profile (distance vs elevation, ascent/descent) for a bike route
// @route   POST /api/v1/bikes/elevation
// @access  Public
export const getBikesElevation = asyncHandler(async (req, res, next) => {
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
