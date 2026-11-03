const configuredOrigins = () => (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  const cleanOrigin = origin.trim().replace(/\/+$/, '');
  const allowed = configuredOrigins();

  for (const item of allowed) {
    if (item === '*' || item === cleanOrigin) return true;
    if (item.startsWith('*.') && cleanOrigin.endsWith(item.slice(1))) return true;
    if (item.startsWith('https://*.') && cleanOrigin.startsWith('https://') && cleanOrigin.endsWith(item.replace('https://*.', ''))) return true;
  }

  // Automatically allow Otion Vercel deployments and localhost
  if (/^https:\/\/otion[a-z0-9-]*\.vercel\.app$/.test(cleanOrigin)) return true;
  if (/^http:\/\/localhost(:\d+)?$/.test(cleanOrigin)) return true;

  return false;
};

const corsOptions = () => ({
  credentials: true,
  origin(origin, callback) {
    if (isOriginAllowed(origin)) return callback(null, true);
    const error = new Error('Origin is not allowed');
    error.statusCode = 403;
    error.code = 'ORIGIN_NOT_ALLOWED';
    return callback(error);
  },
});

module.exports = { configuredOrigins, isOriginAllowed, corsOptions };
