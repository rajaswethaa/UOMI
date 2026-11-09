
const ApiError = require('../utils/api-error');

// Handle routes that do not exist
function notFound(req, res, next) {
  return next(
    new ApiError(404, `Route ${req.method} ${req.originalUrl} not found`)
  );
}

// Central error-handling middleware
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details;

  // PostgreSQL error codes
  if (err.code === '23505') {
    statusCode = 409;
    message = 'A record with these details already exists';
  } else if (err.code === '23503') {
    statusCode = 409;
    message = 'A related record does not exist';
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Malformed JSON body';
  }

  // Log complete server errors for debugging
  if (statusCode >= 500) {
    console.error('\n========== UOMi BACKEND ERROR ==========');
    console.error('Method:', req.method);
    console.error('URL:', req.originalUrl);
    console.error('Message:', err.message);
    console.error('Stack:', err.stack || err);
    console.error('========================================\n');
  }

  const payload = {
    success: false,
    message
  };

  if (details) {
    payload.details = details;
  }

  // Include stack trace only during development
  if (statusCode >= 500 && process.env.NODE_ENV !== 'production') {
    payload.stack = err.stack;
  }

  return res.status(statusCode).json(payload);
}

module.exports = {
  notFound,
  errorHandler
};
