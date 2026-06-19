import axios from 'axios';
import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../middleware/async.js';

// @desc    GET locations
// @route   GET /api/v1/locations
// @access  Public
export const getLocations = asyncHandler(async (req, res, next) => {
  const config = {
    method: 'get',
    url: `${process.env.TRP_ENDPOINT}/v1/locations`,
    params: { query: req.query.location, type: req.query.type },
    headers: {
      accept: 'application/json'
    },
  };
  try {
    let response = await axios(config);
    if (!response.data) {
      return next(new ErrorResponse(`No locations data found`, 404));
    }
    res.status(200).json({ success: true, data: response.data });
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
export const getConnections = asyncHandler(async (req, res, next) => {
  const vias = req.query.via ? (Array.isArray(req.query.via) ? req.query.via : [req.query.via]) : [];
  const params = { limit: req.query.limit, from: req.query.from, to: req.query.to, isArrivalTime: req.query.isArrivalTime || 'false' };
  if (req.query.date) params.date = req.query.date;
  if (req.query.time) params.time = req.query.time;
  vias.forEach((v, i) => { params[`via[${i}]`] = v; });
  const config = {
    method: 'get',
    url: `${process.env.TRP_ENDPOINT}/v1/connections`,
    params,
    headers: {
      accept: 'application/json'
    },
  };
  try {
    let response = await axios(config);
    if (!response.data) {
      return next(new ErrorResponse(`No connections data found`, 404));
    }
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    next(
      new ErrorResponse(`An error occurred during the request: ${error}`, 500)
    );
  }
});

// @desc    GET connections/jouney
// @route   GET /api/v1/connections/journey
// @access  Public
export const getConnectionJourneys = asyncHandler(async (req, res, next) => {
  const vias = req.query.via ? (Array.isArray(req.query.via) ? req.query.via : [req.query.via]) : [];
  const params = {
    from: req.query.from,
    to: req.query.to,
    isArrivalTime: req.query.isArrivalTime || 'false',
    'fields[]': 'connections/sections/journey/passList/station',
  };
  if (req.query.date) params.date = req.query.date;
  if (req.query.time) params.time = req.query.time;
  vias.forEach((v, i) => { params[`via[${i}]`] = v; });
  const config = {
    method: 'get',
    url: `${process.env.TRP_ENDPOINT}/v1/connections`,
    params,
    headers: {
      accept: 'application/json'
    },
  };
  try {
    let response = await axios(config);
    if (!response.data) {
      return next(new ErrorResponse(`No connections data found`, 404));
    }
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    console.error(error);
    next(
      new ErrorResponse(`An error occurred during the request: ${error}`, 500)
    );
  }
});