import ErrorResponse from '../utils/errorResponse.js';

const errorHandler = (err, req, res, next) => {
  let error = { ...err };

  error.message = err.message;

  // Log to console for dev
  console.log(err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = `Resource not found`;
    error = new ErrorResponse(message, 404);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = `Duplicate value field entered: ${err.keyValue.name}`;
    error = new ErrorResponse(message, 400);
  }

  // Mongoose Validaton errors for required fields
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((val) => val.message);
    error = new ErrorResponse(message, 400);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    err: error.message || 'Server Error',
    // Machine-readable code (ErrorResponse's third arg) — string-only so Mongo's numeric
    // err.code (e.g. 11000) never leaks into the response.
    ...(typeof error.code === 'string' && { code: error.code }),
  });
};

export default errorHandler;
