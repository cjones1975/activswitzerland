import axios from 'axios';

// Extracted from controllers/weather.js's getWeather so the AI chat tool can call the same
// Open-Meteo request as a plain function, without a fake req/res.
export async function fetchWeatherForecast({ lat, lon }) {
    const params = {
        latitude: lat,
        longitude: lon,
        hourly: 'temperature_2m,relativehumidity_2m,weathercode,windspeed_10m,winddirection_10m,precipitation_probability',
        daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,uv_index_max,daylight_duration',
        forecast_days: 7,
        timezone: 'Europe/Zurich',
    };
    const response = await axios({
        method: 'get',
        url: process.env.MTO_ENDPOINT,
        params,
        headers: { accept: 'application/json' },
    });
    return response.data;
}
