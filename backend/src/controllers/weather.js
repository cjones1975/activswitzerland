import axios from 'axios';
import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../middleware/async.js';

// @desc    GET weather
// @route   GET /api/v1/weather
// @access  Public
export const getWeather = asyncHandler(async (req, res, next) => {
    const { lat, lon } = req.query;

    const params = {
        latitude: lat,
        longitude: lon,
        hourly: 'temperature_2m,relativehumidity_2m,weathercode,windspeed_10m,winddirection_10m,precipitation_probability',
        daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,uv_index_max,daylight_duration',
        forecast_days: 7,
        timezone: 'Europe/Zurich',
    };
    const config = {
        method: 'get',
        url: process.env.MTO_ENDPOINT,
        params,
        headers: {
            accept: 'application/json',
        },
    };
    try {
        let response = await axios(config);
        if (!response.data) {
            return next(new ErrorResponse(`No weather data found`, 404));
        }
        res.status(200).json({ success: true, data: response.data });
    } catch (error) {
        console.error(error);
        next(
            new ErrorResponse(`An error occurred during the request: ${error}`, 500)
        );
    }

})