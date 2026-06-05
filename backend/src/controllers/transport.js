import axios from 'axios';
import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../middleware/async.js';

// @desc    GET locations
// @route   GET /api/v1/locations
// @access  Public
export const getLocations = asyncHandler(async (req, res, next) => {
  const config = {
    method: 'get',
    url: `${process.env.TRP_ENDPOINT}/v1/locations?query=${req.query.location}&type=${req.query.type}`,
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
  const config = {
    method: 'get',
    url: `${process.env.TRP_ENDPOINT}/v1/connections?from=${req.query.from}&to=${req.query.to}&via[]=${req.query.via}&date=${req.query.date}&time=${req.query.time}&isArrivalTime=${req.query.isArrivalTime}`,
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