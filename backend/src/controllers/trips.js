import asyncHandler from '../middleware/async.js';
import ErrorResponse from '../utils/errorResponse.js';
import Trip from '../models/Trip.js';

// @desc   Get all trips for the logged-in user
// @route  GET /api/v1/trips
// @access Private
export const getTrips = asyncHandler(async (req, res) => {
    const trips = await Trip.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: trips.length, data: trips });
});

// @desc   Save a new trip
// @route  POST /api/v1/trips
// @access Private
export const createTrip = asyncHandler(async (req, res) => {
    const { name, type, dateMode, range, stops, connections, activities, routeCoordinates } = req.body;
    const trip = await Trip.create({
        user: req.user.id,
        name,
        type,
        dateMode,
        range,
        stops,
        connections: connections ?? [],
        activities: activities ?? [],
        routeCoordinates: routeCoordinates ?? [],
    });
    res.status(201).json({ success: true, data: trip });
});

// @desc   Update a trip
// @route  PUT /api/v1/trips/:id
// @access Private
export const updateTrip = asyncHandler(async (req, res, next) => {
    let trip = await Trip.findById(req.params.id);
    if (!trip) return next(new ErrorResponse('Trip not found', 404));
    if (trip.user.toString() !== req.user.id) {
        return next(new ErrorResponse('Not authorised to update this trip', 401));
    }
    trip = await Trip.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.status(200).json({ success: true, data: trip });
});

// @desc   Delete a trip
// @route  DELETE /api/v1/trips/:id
// @access Private
export const deleteTrip = asyncHandler(async (req, res, next) => {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return next(new ErrorResponse('Trip not found', 404));
    if (trip.user.toString() !== req.user.id) {
        return next(new ErrorResponse('Not authorised to delete this trip', 401));
    }
    await trip.deleteOne();
    res.status(200).json({ success: true, data: {} });
});
