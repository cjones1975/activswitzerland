import axios from 'axios';
import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../middleware/async.js';

// @desc    GET destinations
// @route   GET /api/v1/destinations
// @access  Public
export const getDestinations = asyncHandler(async (req, res, next) => {
  const config = {
    method: 'get',
    url: `${process.env.MYS_ENDPOINT}/v1/destinations/?lang=${req.query.language}&page=${req.query.page}&hitsPerPage=${req.query.hitsPerPage}&facet.filter=${encodeURIComponent(req.query.facets)}&facets.translate=${req.query.translate}&expand=${req.query.expand}&striphtml=${req.query.stripHtml}&top=${req.query.top}`,
    headers: {
      'x-api-key': process.env.MYS_KEY,
      accept: 'application/json'
    },
  };
  try {
    let response = await axios(config);
    if (!response.data) {
      return next(new ErrorResponse(`No destination data found`, 404));
    }
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    console.error(error);
    next(
      new ErrorResponse(`An error occurred during the request: ${error}`, 500)
    );
  }
});

// @desc    GET destinations by GEO box
// @route   GET /api/v1/destinationsByGeobBox
// @access  Public
export const getDestinationsByGeobBox = asyncHandler(async (req, res, next) => {
  const config = {
    method: 'get',
    url: `${process.env.MYS_ENDPOINT}/v1/destinations/?lang=${req.query.language}&page=${req.query.page}&hitsPerPage=${req.query.hitsPerPage}&geo.bbox=${encodeURIComponent(req.query.geobbox)}&facets.translate=${req.query.translate}&expand=${req.query.expand}&striphtml=${req.query.stripHtml}&top=${req.query.top}`,
    headers: {
      'x-api-key': process.env.MYS_KEY,
      accept: 'application/json'
    },
  };
  try {
    let response = await axios(config);
    if (!response.data) {
      return next(new ErrorResponse(`No destination data found`, 404));
    }
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    console.error(error);
    next(
      new ErrorResponse(`An error occurred during the request: ${error}`, 500)
    );
  }
});

// @desc    GET destination:id
// @route   GET /api/v1/destination:id
// @access  Public
export const getDestination = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const config = {
    method: 'get',
    url: `${process.env.MYS_ENDPOINT}/v1/destinations/${id}?lang=${req.query.language}&striphtml=${req.query.stripHtml}`,
    headers: {
      'x-api-key': process.env.MYS_KEY,
      accept: 'application/json'
    },
  };

  try {
    const response = await axios(config);

    if (!response.data) {
      return next(new ErrorResponse(`No destination data found for id ${id}`, 404));
    }

    res.status(200).json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error(error);

    next(
      new ErrorResponse(
        `An error occurred during the request: ${error.message}`,
        500
      )
    );
  }
});

// @desc    GET top attractions
// @route   GET /api/v1/attractions
// @access  Public
export const getTopAttractions = asyncHandler(async (req, res, next) => {
  const config = {
    method: 'get',
    url: `${process.env.MYS_ENDPOINT}/v1/attractions/?lang=${req.query.language}&page=${req.query.page}&hitsPerPage=${req.query.hitsPerPage}&placeId=${req.query.placeId}&facets.translate=${req.query.translate}&expand=${req.query.expand}&striphtml=${req.query.stripHtml}&top=${req.query.top}`,
    headers: {
      'x-api-key': process.env.MYS_KEY,
      accept: 'application/json'
    },
  };
  try {
    let response = await axios(config);
    if (!response.data) {
      return next(new ErrorResponse(`No attraction data found`, 404));
    }
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    console.error(error);
    next(
      new ErrorResponse(`An error occurred during the request: ${error}`, 500)
    );
  }
});

// @desc    GET attractions
// @route   GET /api/v1/attractions
// @access  Public
export const getAttractions = asyncHandler(async (req, res, next) => {
  const config = {
    method: 'get',
    url: `${process.env.MYS_ENDPOINT}/v1/attractions/?lang=${req.query.language}&page=${req.query.page}&hitsPerPage=${req.query.hitsPerPage}&placeId=${req.query.placeId}&facets.translate=${req.query.translate}&expand=${req.query.expand}&striphtml=${req.query.stripHtml}`,
    headers: {
      'x-api-key': process.env.MYS_KEY,
      accept: 'application/json'
    },
  };
  try {
    let response = await axios(config);
    if (!response.data) {
      return next(new ErrorResponse(`No attraction data found`, 404));
    }
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    console.error(error);
    next(
      new ErrorResponse(`An error occurred during the request: ${error}`, 500)
    );
  }
});
