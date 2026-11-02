const configuredOrigins = () => (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = () => {
  const allowed = new Set(configuredOrigins());
  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowed.has(origin)) return callback(null, true);
      const error = new Error('Origin is not allowed');
      error.statusCode = 403;
      error.code = 'ORIGIN_NOT_ALLOWED';
      return callback(error);
    },
  };
};

module.exports = { configuredOrigins, corsOptions };
