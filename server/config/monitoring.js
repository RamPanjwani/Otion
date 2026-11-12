/**
 * Optional error tracking.
 *
 * Nothing is reported unless SENTRY_DSN is configured, so local development,
 * tests and previews stay silent and no Sentry account is required to run the
 * project. `initMonitoring()` must run before `express` is required so the
 * Express integration can instrument the module it patches.
 */
const Sentry = require('@sentry/node');

const SENSITIVE_HEADERS = ['authorization', 'cookie', 'set-cookie', 'x-api-key', 'x-csrf-token'];

let enabled = false;

const scrub = (event) => {
  const headers = event.request?.headers;
  if (headers) {
    for (const name of SENSITIVE_HEADERS) {
      if (headers[name]) delete headers[name];
    }
  }
  return event;
};

const initMonitoring = ({ dsn = process.env.SENTRY_DSN, environment } = {}) => {
  if (enabled) return true;
  // `test` stays offline even when a developer exports a real DSN.
  if (!dsn || process.env.NODE_ENV === 'test') return false;

  try {
    Sentry.init({
      dsn,
      environment: environment || process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      release: process.env.SENTRY_RELEASE || undefined,
      sendDefaultPii: false,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
      integrations: [Sentry.expressIntegration()],
      beforeSend: scrub,
    });
    enabled = true;
    return true;
  } catch (error) {
    // A malformed DSN must never take the API down.
    console.error(`Error tracking disabled: ${error.message}`);
    return false;
  }
};

const isEnabled = () => enabled;

const captureException = (error, context) => {
  if (!enabled) return undefined;
  return Sentry.captureException(error, context ? { extra: context } : undefined);
};

const flush = async (timeout = 2000) => {
  if (!enabled) return true;
  return Sentry.flush(timeout);
};

module.exports = { initMonitoring, isEnabled, captureException, flush };
