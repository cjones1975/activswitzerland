import asyncHandler from '../middleware/async.js';
import ErrorResponse from '../utils/errorResponse.js';
import Hike from '../models/Hike.js';
import Trip from '../models/Trip.js';
import { parseGpx, generateRouteNumber } from '../utils/customHikes.js';

// @desc    List all custom hikes
// @route   GET /api/v1/admin/hikes
// @access  Private/Admin
export const getAdminHikes = asyncHandler(async (req, res) => {
    const hikes = await Hike.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: hikes.length, data: hikes });
});

// @desc    Parse a GPX file and return its computed stats, without saving anything
// @route   POST /api/v1/admin/hikes/preview
// @access  Private/Admin
export const previewHike = asyncHandler(async (req, res, next) => {
    const { gpx } = req.body;
    if (!gpx) return next(new ErrorResponse('gpx is required', 400));

    let parsed;
    try {
        parsed = parseGpx(gpx);
    } catch (err) {
        return next(new ErrorResponse(err.message, 400));
    }

    res.status(200).json({ success: true, data: parsed });
});

// @desc    Add a new custom hike
// @route   POST /api/v1/admin/hikes
// @access  Private/Admin
export const createAdminHike = asyncHandler(async (req, res, next) => {
    const { name, gpx } = req.body;
    if (!name || !gpx) return next(new ErrorResponse('name and gpx are required', 400));

    let parsed;
    try {
        parsed = parseGpx(gpx);
    } catch (err) {
        return next(new ErrorResponse(err.message, 400));
    }

    const hike = await Hike.create({
        routeNumber: generateRouteNumber(name),
        name,
        distanceKm: parsed.distanceKm,
        distanceMiles: parsed.distanceMiles,
        stages: [parsed.stage],
        ascentM: parsed.ascentM,
        descentM: parsed.descentM,
        minElevation: parsed.minElevation,
        maxElevation: parsed.maxElevation,
        startPoint: parsed.startPoint,
        endPoint: parsed.endPoint,
    });

    res.status(201).json({ success: true, data: hike });
});

// @desc    Rename a custom hike (metadata-only - no GPX replacement in this pass)
// @route   PATCH /api/v1/admin/hikes/:id
// @access  Private/Admin
export const updateAdminHike = asyncHandler(async (req, res, next) => {
    const { name } = req.body;
    if (!name) return next(new ErrorResponse('name is required', 400));

    const hike = await Hike.findByIdAndUpdate(req.params.id, { name }, { new: true, runValidators: true });
    if (!hike) return next(new ErrorResponse('Hike not found', 404));

    res.status(200).json({ success: true, data: hike });
});

// @desc    Delete a custom hike, cascading its removal from any saved trips
// @route   DELETE /api/v1/admin/hikes/:id
// @access  Private/Admin
export const deleteAdminHike = asyncHandler(async (req, res, next) => {
    const hike = await Hike.findById(req.params.id);
    if (!hike) return next(new ErrorResponse('Hike not found', 404));

    // Trip.distanceKm is the road/rail route distance (routeDistanceKm), not a sum of activity
    // distances - so pulling the activity here needs no distanceKm recompute on the trip.
    await Trip.updateMany(
        { activities: { $elemMatch: { kind: 'hike', refId: hike.routeNumber } } },
        { $pull: { activities: { kind: 'hike', refId: hike.routeNumber } } }
    );
    await hike.deleteOne();

    res.status(200).json({ success: true, data: {} });
});
