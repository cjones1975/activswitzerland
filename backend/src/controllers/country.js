import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../middleware/async.js';
import Country from '../models/Country.js';

// @desc    Get Countries
// @route   GET /api/v1/auth/countries
// @access Public
export const getCountries = asyncHandler(async (req, res, next) => {
    try {
        const countries = await Country.find().sort({ shortName: 1 });

        return res.status(200).json({
            success: true,
            count: countries.length,
            data: countries,
        });
    } catch (error) {
        return next(
            new ErrorResponse(
                `No countries found ${error}`,
                404
            )
        );
    }
})