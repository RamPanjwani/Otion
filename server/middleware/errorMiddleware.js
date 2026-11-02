const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Route not found: ${req.originalUrl}`));
};

const errorHandler = (error, req, res, next) => {
  void next;
  const status = error.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  const fallbackCode = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHENTICATED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    429: 'RATE_LIMITED',
    500: 'INTERNAL_ERROR',
  }[status] || 'REQUEST_FAILED';
  if (status >= 500) req.log?.error({ err: error }, 'Unhandled request error');
  const message = status >= 500 && process.env.NODE_ENV === 'production'
    ? 'Unexpected server error'
    : error.message || 'Unexpected server error';
  res.status(status).json({
    message,
    error: {
      code: error.code || fallbackCode,
      message,
      details: error.details,
      requestId: req.id,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    },
  });
};

module.exports = { notFound, errorHandler };
