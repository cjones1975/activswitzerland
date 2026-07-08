import proj4 from 'proj4';
import ErrorResponse from '../utils/errorResponse.js';

// WGS84 -> LV95 (Swiss CH1903+ projection). This towgs84 approximation is
// accurate to ~1-2m, which is more than enough for a radius search.
proj4.defs(
  'EPSG:2056',
  '+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 ' +
  '+k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel ' +
  '+towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs'
);

// Converts req.query.lat/lon (WGS84) to LV95 easting/northing and attaches
// the result as req.lv95 for downstream controllers.
export const convertToLV95 = (req, res, next) => {
  const { lat, lon } = req.query;

  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);

  if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
    return next(new ErrorResponse('lat and lon query params are required and must be numeric', 400));
  }

  const [easting, northing] = proj4('EPSG:4326', 'EPSG:2056', [lonNum, latNum]);
  req.lv95 = { easting, northing };

  next();
};

export default convertToLV95;
