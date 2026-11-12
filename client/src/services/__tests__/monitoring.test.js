import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import http from 'node:http';
import test from 'node:test';

// Fresh module per test: `enabled` is process-wide once a DSN is initialised.
let loads = 0;
const load = () => import(`../monitoring.js?case=${(loads += 1)}`);

const startSink = async () => {
  const received = [];
  const server = http.createServer((request, response) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      received.push({ url: request.url, body: Buffer.concat(chunks).toString() });
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('{}');
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    dsn: `http://public@127.0.0.1:${server.address().port}/1`,
    received,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
};

// The SDK is a singleton, so shut the client down between cases.
const stopSdk = async (sink) => {
  try {
    const Sentry = await import('@sentry/react');
    await Sentry.close(1000);
  } finally {
    await sink.close();
  }
};

test('stays inert without a DSN', async () => {
  const monitoring = await load();
  assert.equal(await monitoring.initMonitoring(), false);
  assert.equal(monitoring.isEnabled(), false);
});

test('capturing without a DSN is a silent no-op', async () => {
  const monitoring = await load();
  assert.equal(monitoring.captureException(new Error('ignored')), undefined);
  assert.equal(monitoring.isEnabled(), false);
});

test('refuses a malformed DSN instead of pretending to report', async () => {
  const monitoring = await load();
  assert.equal(await monitoring.initMonitoring({ dsn: 'not-a-dsn' }), false);
  assert.equal(monitoring.isEnabled(), false);
});

test('delivers a captured exception to the configured endpoint', async () => {
  const sink = await startSink();
  try {
    const monitoring = await load();
    assert.equal(await monitoring.initMonitoring({ dsn: sink.dsn, environment: 'test' }), true);
    assert.equal(monitoring.isEnabled(), true);

    monitoring.captureException(new Error('client boom'), { route: '/dashboard' });

    const Sentry = await import('@sentry/react');
    await Sentry.flush(3000);
    assert.equal(sink.received.length, 1, 'expected exactly one envelope');
    assert.match(sink.received[0].url, /\/api\/1\/envelope\//);
    assert.match(sink.received[0].body, /client boom/);
  } finally {
    await stopSdk(sink);
  }
});

test('strips credentials and tokenised URLs before sending', async () => {
  const sink = await startSink();
  try {
    const monitoring = await load();
    await monitoring.initMonitoring({ dsn: sink.dsn, environment: 'test' });

    // An event shaped like the ones the SDK builds for failed requests.
    const Sentry = await import('@sentry/react');
    Sentry.captureEvent({
      message: 'scrub probe',
      request: {
        url: 'https://otion.test/api/notes?token=supersecret&page=2',
        headers: { authorization: 'Bearer topsecret', cookie: 'session=abc', accept: 'application/json' },
      },
    });
    await Sentry.flush(3000);

    assert.equal(sink.received.length, 1);
    const body = sink.received[0].body;
    assert.doesNotMatch(body, /supersecret/);
    assert.doesNotMatch(body, /topsecret/);
    assert.doesNotMatch(body, /session=abc/);
    assert.match(body, /\[Filtered\]/);
    assert.match(body, /application\/json/, 'non-sensitive headers survive');
  } finally {
    await stopSdk(sink);
  }
});
