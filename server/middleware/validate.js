const { ZodError } = require('zod');

const validationError = (error) => {
  const normalized = new Error('Request validation failed');
  normalized.statusCode = 400;
  normalized.code = 'VALIDATION_ERROR';
  normalized.details = error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
  return normalized;
};

const validate = (schemas = {}) => (req, res, next) => {
  try {
    if (schemas.params) req.params = schemas.params.parse(req.params);
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.query) req.validatedQuery = schemas.query.parse(req.query);
    next();
  } catch (error) {
    next(error instanceof ZodError ? validationError(error) : error);
  }
};

module.exports = { validate };
