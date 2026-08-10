import axios from 'axios';
import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../middleware/async.js';
import {
  buildLocationInformationRequest, parseLocationInformationResponse,
  buildTripRequest, parseTripResponse, zurichLocalToUtcIso,
} from '../utils/ojp.js';

const STOP_PLACE_REF = /^ch:\d+:sloid:/;

function ojpConfig(body) {
  return {
    method: 'post',
    url: process.env.OPENTRANSPORTDATA_ENDPOINT,
    data: body,
    headers: {
      accept: 'application/xml',
      'Content-Type': 'application/xml',
      Authorization: `Bearer ${process.env.TOKEN}`,
    },
  };
}

// `from`/`to` are `TripStop.externalId` (an OJP StopPlaceRef) whenever the stop was picked via
// rail station search — the only real case, since ConnectionLegPicker is rail-only. Falls back to
// a location lookup only for a plain name, the same defensive stance as the location endpoint.
async function resolveStopRef(value) {
  if (STOP_PLACE_REF.test(value)) return value;
  const response = await axios(ojpConfig(buildLocationInformationRequest(value, 'station', 'en')));
  const [station] = parseLocationInformationResponse(response.data, 'station');
  if (!station) throw new Error(`Could not resolve location "${value}"`);
  return station.id;
}

// @desc    GET locations
// @route   GET /api/v1/locations
// @access  Public
export const getLocations = asyncHandler(async (req, res, next) => {
  const config = {
    method: 'post',
    url: process.env.OPENTRANSPORTDATA_ENDPOINT,
    data: buildLocationInformationRequest(req.query.location, req.query.type, req.query.lang),
    headers: {
      accept: 'application/xml',
      'Content-Type': 'application/xml',
      Authorization: `Bearer ${process.env.TOKEN}`,
    },
  };
  try {
    let response = await axios(config);
    if (!response.data) {
      return next(new ErrorResponse(`No locations data found`, 404));
    }
    const stations = parseLocationInformationResponse(response.data, req.query.type);
    res.status(200).json({ success: true, data: { stations } });
  } catch (error) {
    console.error(error);
    next(
      new ErrorResponse(`An error occurred during the request: ${error}`, 500)
    );
  }
});

// @desc    GET connections
// @route   GET /api/v1/connections
// @access  Public
// No `via` support — confirmed live that OJP's `<Via>` element 500s on this endpoint regardless
// of request shape, and confirmed via code search that the frontend's only caller (rail-only
// `ConnectionLegPicker`) never sends one anyway. See ojp-trip-request-spec.md.
export const getConnections = asyncHandler(async (req, res, next) => {
  try {
    const [originRef, destRef] = await Promise.all([
      resolveStopRef(req.query.from),
      resolveStopRef(req.query.to),
    ]);
    const isArrivalTime = req.query.isArrivalTime === 'true';
    const body = buildTripRequest({
      originRef,
      destRef,
      dateTime: zurichLocalToUtcIso(req.query.date, req.query.time),
      isArrivalTime,
      numberOfResults: req.query.limit,
    });
    const response = await axios(ojpConfig(body));
    if (!response.data) {
      return next(new ErrorResponse(`No connections data found`, 404));
    }
    const connections = parseTripResponse(response.data);
    res.status(200).json({ success: true, data: { connections } });
  } catch (error) {
    console.error(error);
    next(
      new ErrorResponse(`An error occurred during the request: ${error}`, 500)
    );
  }
});

// @desc    GET connections/journeys
// @route   GET /api/v1/connections/journeys
// @access  Public
// Same search as getConnections, kept as its own OJP round-trip (not consolidated) so
// `TransportService`'s existing two-call contract needs no frontend change beyond from/to. Only
// `sections` is populated — `extractPassListCoords()` on the frontend is all that reads this.
// `numberOfResults` is hardcoded to match getConnections' default (the frontend never sends a
// `limit` here) so both calls return the same result count/order for the same from/to/date/time.
export const getConnectionJourneys = asyncHandler(async (req, res, next) => {
  try {
    const [originRef, destRef] = await Promise.all([
      resolveStopRef(req.query.from),
      resolveStopRef(req.query.to),
    ]);
    const isArrivalTime = req.query.isArrivalTime === 'true';
    const body = buildTripRequest({
      originRef,
      destRef,
      dateTime: zurichLocalToUtcIso(req.query.date, req.query.time),
      isArrivalTime,
      numberOfResults: 6,
    });
    const response = await axios(ojpConfig(body));
    if (!response.data) {
      return next(new ErrorResponse(`No connections data found`, 404));
    }
    const connections = parseTripResponse(response.data).map(({ sections }) => ({ sections }));
    res.status(200).json({ success: true, data: { connections } });
  } catch (error) {
    console.error(error);
    next(
      new ErrorResponse(`An error occurred during the request: ${error}`, 500)
    );
  }
});