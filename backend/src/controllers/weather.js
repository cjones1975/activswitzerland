import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../middleware/async.js';
import { fetchWeatherForecast } from '../utils/weather.js';

// @desc    GET weather
// @route   GET /api/v1/weather
// @access  Public
export const getWeather = asyncHandler(async (req, res, next) => {
    const { lat, lon } = req.query;

    try {
        const data = await fetchWeatherForecast({ lat, lon });
        if (!data) {
            return next(new ErrorResponse(`No weather data found`, 404));
        }
        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error(error);
        next(
            new ErrorResponse(`An error occurred during the request: ${error}`, 500)
        );
    }

})
