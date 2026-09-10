import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../middleware/async.js';
import HotelDestination from '../models/HotelDestination.js';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_CURRENCIES = ['CHF', 'EUR', 'GBP', 'USD'];

// Regex only confirms the YYYY-MM-DD shape — Date.parse('2026-02-30') still returns NaN rather than
// throwing, so an impossible calendar date needs its own check rather than falling out of the
// subsequent checkout > checkin comparison (NaN <= NaN is false, which would silently pass).
const isValidIsoDate = (value) => {
    if (!ISO_DATE_RE.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

// @desc    GET hotel destination mappings
// @route   GET /api/v1/hotels/destinations
// @access  Public
export const getHotelDestinations = asyncHandler(async (req, res, next) => {
    try {
        const destinations = await HotelDestination.find();

        return res.status(200).json({
            success: true,
            data: destinations,
        });
    } catch (error) {
        return next(
            new ErrorResponse(`No hotel destinations found ${error}`, 404)
        );
    }
});

// @desc    GET a CJ-wrapped Booking.com deep link for a mapped destination
// @route   GET /api/v1/hotels/deeplink
// @access  Public
export const getHotelDeeplink = asyncHandler(async (req, res, next) => {
    const { identifier, checkin, checkout, groupAdults, groupChildren, noRooms, currency, lang } = req.query;

    const destination = await HotelDestination.findOne({ identifier });
    if (!destination) {
        return next(new ErrorResponse('Destination is not mapped for hotel search', 404));
    }

    if (!isValidIsoDate(checkin) || !isValidIsoDate(checkout)) {
        return next(new ErrorResponse('checkin and checkout must be a valid date in YYYY-MM-DD format', 400));
    }
    if (Date.parse(checkout) <= Date.parse(checkin)) {
        return next(new ErrorResponse('checkout must be after checkin', 400));
    }

    const adults = Number(groupAdults);
    const children = Number(groupChildren ?? 0);
    const rooms = Number(noRooms);
    if (!Number.isInteger(adults) || adults < 1) {
        return next(new ErrorResponse('groupAdults must be an integer >= 1', 400));
    }
    if (!Number.isInteger(children) || children < 0) {
        return next(new ErrorResponse('groupChildren must be an integer >= 0', 400));
    }
    if (!Number.isInteger(rooms) || rooms < 1) {
        return next(new ErrorResponse('noRooms must be an integer >= 1', 400));
    }

    if (!ALLOWED_CURRENCIES.includes(currency)) {
        return next(new ErrorResponse(`currency must be one of ${ALLOWED_CURRENCIES.join(', ')}`, 400));
    }
    if (!lang) {
        return next(new ErrorResponse('lang is required', 400));
    }

    // CJEVENT={eventId} is a literal placeholder CJ's redirect substitutes with a real event id at
    // click time — it must reach Booking.com unsubstituted from here. aid/label/utm_* are NOT built
    // here; CJ's redirect appends those itself based on the site/pid pair in the wrapper URL below.
    //
    // bookingUrl is built as one plain string with only its free-form-text fields (ss, lang)
    // individually encoded, then the WHOLE string is passed through encodeURIComponent exactly once
    // more, when embedding it as the wrapper's `url` value. This is two distinct, correctly-scoped
    // encoding passes, not "double encoding": encoding ss/lang here makes the inner Booking.com query
    // string valid on its own (e.g. destination names like "Sion / Sitten" containing characters that
    // would otherwise be misread as query-string structure); the second, whole-string pass round-trips
    // that untouched through CJ's one-time decode. CJEVENT={eventId} is the one exception — it must
    // stay completely unencoded here, since CJ's redirect does a literal text match for `{eventId}`
    // against the once-decoded inner URL to know where to substitute the real event id; pre-encoding
    // it (or running URLSearchParams over the whole query string, which encodes it as a side effect)
    // hides that literal text from CJ's matcher and silently breaks tracking. dest_id/dest_type come
    // from our own trusted DB rows and currency/checkin/checkout/adults/rooms/children are already
    // validated above, so none of those need encoding.
    const bookingUrl = `https://www.booking.com/searchresults.html?CJEVENT={eventId}&ss=${encodeURIComponent(destination.name)}&dest_id=${destination.destId}&dest_type=${destination.destType}&lang=${encodeURIComponent(lang)}&selected_currency=${currency}&checkin=${checkin}&checkout=${checkout}&group_adults=${adults}&no_rooms=${rooms}&group_children=${children}`;
    const url = `https://${process.env.CJ_REDIRECT_HOST}/click-${process.env.CJ_SITE_ID}-${process.env.CJ_PID}?url=${encodeURIComponent(bookingUrl)}`;

    return res.status(200).json({
        success: true,
        data: { url },
    });
});
