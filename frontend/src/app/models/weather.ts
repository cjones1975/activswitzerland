import { Destination } from './destination';

export type WeatherPayload = {
  lat: number;
  lon: number;
  locationName?: string;
  destination?: Destination;
};

export interface WeatherCodeInfo {
    code: number;
    label: string;
    icon: string;
}

export interface HourlyPoint {
    time: string;          // '2025-11-14T13:00'
    date: string;          // '2025-11-14'
    temperature: number;   // °C
    humidity: number;      // %
    weatherCode: WeatherCodeInfo;
    precipitationProb?: number; // %
    windSpeedKmh?: number;      // km/h
    windDirection?: number;
}

export interface DailyForecast {
    date: string;
    maxTemp: number;
    minTemp: number;
    precipitationMm: number;
    weatherCode: WeatherCodeInfo;
    hourly: HourlyPoint[];
    uvIndex: number;
    daylightDuration: number;
}

export interface WeatherMeta {
    elevation?: number;
    timezoneAbbreviation?: string;
    locationName?: string;
}

export interface ForecastViewModel {
    days: DailyForecast[];
    meta?: WeatherMeta;
}

// --- Weather code map (WMO codes from Open-Meteo) ---

const WEATHER_CODE_MAP: Record<number, WeatherCodeInfo> = {
    0: { code: 0, label: 'Clear sky', icon: 'fa-light fa-sun' },
    1: { code: 1, label: 'Mainly clear', icon: 'fa-light fa-sun-cloud' },
    2: { code: 2, label: 'Partly cloudy', icon: 'fa-light fa-cloud-sun' },
    3: { code: 3, label: 'Overcast', icon: 'fa-light fa-cloud' },
    45: { code: 45, label: 'Fog', icon: 'fa-light fa-cloud-fog' },
    48: { code: 48, label: 'Fog', icon: 'fa-light fa-cloud-fog' },
    51: { code: 51, label: 'Light drizzel', icon: 'fa-light fa-cloud-drizzle' },
    53: { code: 53, label: 'Moderate drizzel', icon: 'fa-light fa-cloud-drizzle' },
    55: { code: 55, label: 'Heavy drizzel', icon: 'fa-light fa-cloud-showers' },
    56: { code: 56, label: 'Light freezing rain', icon: 'fa-light fa-cloud-sleet' },
    57: { code: 57, label: 'Heavy freezing rain', icon: 'fa-light fa-cloud-sleet' },
    61: { code: 61, label: 'Sun with possible rain', icon: 'fa-light fa-cloud-sun-rain' },
    63: { code: 63, label: 'Moderate rain', icon: 'fa-light fa-cloud-drizzle' },
    65: { code: 65, label: 'Heavy rain', icon: 'fa-light fa-cloud-showers' },
    66: { code: 66, label: 'Light freezing rain', icon: 'fa-light fa-cloud-sleet' },
    67: { code: 67, label: 'Heavy freezing rain', icon: 'fa-light fa-cloud-sleet' },
    71: { code: 71, label: 'Light Snow', icon: 'fa-light fa-cloud-snow' },
    73: { code: 73, label: 'Moderate Snow', icon: 'fa-light fa-cloud-snow' },
    75: { code: 75, label: 'Heavy Snow', icon: 'fa-light fa-cloud-snow' },
    77: { code: 77, label: 'Snow', icon: 'fa-light fa-cloud-snow' },
    80: { code: 80, label: 'Sun with possible rain', icon: 'fa-light fa-cloud-sun-rain' },
    81: { code: 81, label: 'Moderate rain', icon: 'fa-light fa-cloud-drizzle' },
    82: { code: 81, label: 'Heavy rain', icon: 'fa-light fa-cloud-showers' },
    85: { code: 85, label: 'Ice rain', icon: 'fa-light fa-cloud-sleet' },
    86: { code: 86, label: 'Ice rain', icon: 'fa-light fa-cloud-sleet' },
    95: { code: 95, label: 'Thunderstorms', icon: 'fa-light fa-cloud-bolt-sun' },
    96: { code: 96, label: 'Thunderstorm & rain', icon: 'fa-light fa-cloud-sun-rain' },
    99: { code: 99, label: 'Hail', icon: 'fa-light fa-cloud-hail' },
};

export function mapWeatherCode(code: number): WeatherCodeInfo {
    return WEATHER_CODE_MAP[code] ?? {
        code,
        label: 'Unknown',
        icon: 'wi wi-na',
    };
}

// --- Mapper from Open-Meteo data -> view model ---

export function buildForecastViewModel(apiData: any): ForecastViewModel {
    const h = apiData.hourly;
    const d = apiData.daily;

    const hourlyPoints: HourlyPoint[] = h.time.map((t: string, i: number) => {
        const date = t.split('T')[0];

        // const windSpeedMs = h.windspeed_10m?.[i];         // m/s
        // const windSpeedKmh = windSpeedMs != null ? windSpeedMs * 3.6 : undefined;

        return {
            time: t,
            date,
            temperature: h.temperature_2m[i],
            humidity: h.relativehumidity_2m[i],
            weatherCode: mapWeatherCode(h.weathercode[i]),
            precipitationProb: h.precipitation_probability?.[i],
            windSpeedKmh: h.windspeed_10m?.[i] ?? undefined,
            windDirection: h.winddirection_10m?.[i] ?? undefined,
        };
    });

    const days: DailyForecast[] = d.time.map((date: string, dayIndex: number) => {
        const dayHours = hourlyPoints.filter(p => p.date === date);

        return {
            date,
            maxTemp: d.temperature_2m_max[dayIndex],
            minTemp: d.temperature_2m_min[dayIndex],
            precipitationMm: d.precipitation_sum[dayIndex],
            weatherCode: mapWeatherCode(d.weathercode[dayIndex]),
            hourly: dayHours,
            uvIndex: d.uv_index_max[dayIndex],
            daylightDuration: d.daylight_duration[dayIndex],
        };
    });

    return {
        days,
        meta: {
            elevation: apiData.elevation,
            timezoneAbbreviation: apiData.timezone_abbreviation,
        },
    };
}