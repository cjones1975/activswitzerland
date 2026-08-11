import asyncHandler from '../middleware/async.js';
import ErrorResponse from '../utils/errorResponse.js';
import Trip from '../models/Trip.js';
import { routeDistanceKm } from '../utils/geo.js';
import { generateUniqueSlug, tripDurationLabel } from '../utils/slug.js';

const isSlugTaken = slug => Trip.exists({ slug }).then(Boolean);

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
    const { name, type, dateMode, range, stops, connections, activities, routeCoordinates, isPublic, anonymous } = req.body;
    const slug = isPublic
        ? await generateUniqueSlug(`${name} ${tripDurationLabel(range)}`, isSlugTaken)
        : undefined;
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
        isPublic: isPublic ?? false,
        anonymous: anonymous ?? true,
        distanceKm: routeDistanceKm(routeCoordinates ?? []),
        ...(slug ? { slug } : {}),
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

    // likes only ever change through the dedicated like-toggle endpoint, and slug is
    // server-derived only — neither is ever accepted from a direct trip edit
    const { likes, slug, ...updates } = req.body;
    if (updates.routeCoordinates) {
        updates.distanceKm = routeDistanceKm(updates.routeCoordinates);
    }
    // Slug is assigned once, the first time a trip goes public, and never touched again
    // (even by a later rename) — see trip-detail-pages-spec.md's "Confirmed decisions".
    if (!trip.slug && updates.isPublic === true) {
        const name = updates.name ?? trip.name;
        const range = updates.range ?? trip.range;
        updates.slug = await generateUniqueSlug(`${name} ${tripDurationLabel(range)}`, isSlugTaken);
    }

    trip = await Trip.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
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

// @desc   Browse public trips — reachable with or without auth; skip/limit paginated
// @route  GET /api/v1/trips/public
// @access Public (optionalAuth — likedByMe is only accurate when a valid token is sent)
export const getPublicTrips = asyncHandler(async (req, res) => {
    const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 50);
    const type = ['road', 'rail'].includes(req.query.type) ? req.query.type : null;
    const sortByLikes = req.query.sort === 'likes';
    const sortDir = req.query.order === 'asc' ? 1 : -1;
    const minDistance = req.query.minDistance !== undefined ? Number(req.query.minDistance) : null;
    const maxDistance = req.query.maxDistance !== undefined ? Number(req.query.maxDistance) : null;

    const match = { isPublic: true };
    if (type) match.type = type;
    if (minDistance !== null || maxDistance !== null) {
        match.distanceKm = {};
        if (minDistance !== null) match.distanceKm.$gte = minDistance;
        if (maxDistance !== null) match.distanceKm.$lte = maxDistance;
    }

    const [trips, total] = await Promise.all([
        Trip.aggregate([
            { $match: match },
            { $addFields: { likeCount: { $size: '$likes' } } },
            // sort can't order by array length directly, hence likeCount above
            { $sort: { [sortByLikes ? 'likeCount' : 'createdAt']: sortDir } },
            { $skip: skip },
            { $limit: limit },
            { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'creator' } },
            { $unwind: '$creator' },
        ]),
        Trip.countDocuments(match),
    ]);

    const requesterId = req.user?.id;
    const data = trips.map(({ creator, likes, user, ...trip }) => ({
        ...trip,
        creatorName: trip.anonymous ? null : `${creator.firstName} ${creator.lastName}`,
        creatorCountry: trip.anonymous ? null : creator.country,
        likeCount: trip.likeCount,
        likedByMe: requesterId ? likes.some(id => id.toString() === requesterId) : false,
    }));

    res.status(200).json({ success: true, count: data.length, hasMore: skip + data.length < total, data });
});

// @desc   Fetch a single public trip by its SEO slug, for the standalone trip-detail page
// @route  GET /api/v1/trips/slug/:slug
// @access Public (optionalAuth — likedByMe is only accurate when a valid token is sent)
export const getTripBySlug = asyncHandler(async (req, res, next) => {
    const trip = await Trip.findOne({ slug: req.params.slug, isPublic: true })
        .populate('user', 'firstName lastName country');
    if (!trip) return next(new ErrorResponse('Trip not found', 404));

    const requesterId = req.user?.id;
    const { likes, user, ...rest } = trip.toObject();
    const data = {
        ...rest,
        creatorName: trip.anonymous ? null : `${user.firstName} ${user.lastName}`,
        creatorCountry: trip.anonymous ? null : user.country,
        likeCount: likes.length,
        likedByMe: requesterId ? likes.some(id => id.toString() === requesterId) : false,
    };
    res.status(200).json({ success: true, data });
});

// @desc   Like/unlike a public trip (toggle)
// @route  POST /api/v1/trips/:id/like
// @access Private
export const toggleLike = asyncHandler(async (req, res, next) => {
    const trip = await Trip.findById(req.params.id);
    if (!trip || !trip.isPublic) return next(new ErrorResponse('Trip not found', 404));

    const userId = req.user.id;
    const alreadyLiked = trip.likes.some(id => id.toString() === userId);
    trip.likes = alreadyLiked
        ? trip.likes.filter(id => id.toString() !== userId)
        : [...trip.likes, userId];
    await trip.save();

    res.status(200).json({ success: true, data: { likeCount: trip.likes.length, liked: !alreadyLiked } });
});
