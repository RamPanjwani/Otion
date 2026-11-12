/**
 * Browser error tracking.
 *
 * Nothing is reported unless VITE_SENTRY_DSN is set at build time, so local
 * development, previews and self-hosted builds never contact Sentry and no
 * account is required. The SDK is imported lazily for the same reason: without
 * a DSN it is never fetched, so it costs nothing in the bundle.
 *
 * Errors raised before `initMonitoring()` finishes loading the SDK are kept in
 * a small buffer, because a failure during startup is exactly what we want to
 * capture.
 */

const DSN = import.meta.env?.VITE_SENTRY_DSN;
const ENVIRONMENT = import.meta.env?.VITE_SENTRY_ENVIRONMENT || import.meta.env?.MODE;
const RELEASE = import.meta.env?.VITE_SENTRY_RELEASE;

const MAX_BUFFERED = 5;
const SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-api-key', 'x-csrf-token'];
const SECRET_QUERY = /([?&](?:token|access_token|refresh_token|password)=)[^&#]*/gi;

let sdk = null;
let enabled = false;
let buffered = [];

const scrubUrl = (url) => (typeof url === 'string' ? url.replace(SECRET_QUERY, '$1[Filtered]') : url);

const scrub = (event) => {
  const headers = event.request?.headers;
  if (headers) {
    for (const name of SENSITIVE_HEADERS) {
      if (headers[name]) delete headers[name];
    }
  }
  if (event.request) event.request.url = scrubUrl(event.request.url);
  for (const breadcrumb of event.breadcrumbs || []) {
    if (breadcrumb?.data?.url) breadcrumb.data.url = scrubUrl(breadcrumb.data.url);
  }
  return event;
};

// The browser SDK only logs about a malformed DSN and carries on with a disabled
// client, so validate the shape up front and report the same answer the server does.
const isValidDsn = (dsn) => {
  try {
    const url = new URL(dsn);
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname) && /\/\d+$/.test(url.pathname);
  } catch {
    return false;
  }
};

export const isEnabled = () => enabled;

export const initMonitoring = async ({
  dsn = DSN,
  environment = ENVIRONMENT,
  release = RELEASE,
} = {}) => {
  if (enabled) return true;
  if (!dsn) return false;
  if (!isValidDsn(dsn)) {
    console.warn(`Error tracking disabled: invalid DSN ${dsn}`);
    return false;
  }

  try {
    const Sentry = await import('@sentry/react');
    Sentry.init({
      dsn,
      environment,
      release,
      sendDefaultPii: false,
      tracesSampleRate: Number(import.meta.env?.VITE_SENTRY_TRACES_SAMPLE_RATE || 0),
      beforeSend: scrub,
    });
    sdk = Sentry;
    enabled = true;
    for (const [error, context] of buffered) Sentry.captureException(error, context ? { extra: context } : undefined);
    buffered = [];
    return true;
  } catch (error) {
    // A bad DSN or a blocked request must never break the app.
    console.warn(`Error tracking disabled: ${error.message}`);
    return false;
  }
};

export const captureException = (error, context) => {
  if (!enabled) {
    if (buffered.length < MAX_BUFFERED) buffered.push([error, context]);
    return undefined;
  }
  return sdk.captureException(error, context ? { extra: context } : undefined);
};
