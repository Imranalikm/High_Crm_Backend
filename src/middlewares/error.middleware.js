function errorHandler(err, req, res, next) {
  console.error('[Global Error Handler] Caught error:', err);

  // Sequelize Validation Errors (e.g. Email validation, empty fields)
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors: err.errors.map(e => ({ field: e.path, message: e.message }))
    });
  }

  // Sequelize Unique Constraint Errors (e.g. Username/Email already exists)
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      message: 'Duplicate entry detected.',
      errors: err.errors.map(e => ({ field: e.path, message: `${e.path} must be unique.` }))
    });
  }

  // JWT Specific errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid authorization token.'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Authorization token has expired.'
    });
  }

  // Fallback for general errors
  const statusCode = err.status || 500;
  return res.status(statusCode).json({
    success: false,
    message: err.message || 'An unexpected error occurred on the server.'
  });
}

module.exports = errorHandler;
