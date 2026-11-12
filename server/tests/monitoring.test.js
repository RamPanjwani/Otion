const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const path = require('node:path');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const serverRoot = path.join(__dirname, '..');

// Each case runs in a child process so the SDK's global state cannot leak
// between assertions, and so a real developer DSN in .env cannot interfere.
const runProbe = async (env) => {
  const script = `
    const monitoring = require('./config/monitoring');
    const Sentry = require('@sentry/node');
    const active = monitoring.initMonitoring();
    monitoring.captureException(new Error('probe'));
    monitoring.flush(100);
    process.stdout.write(JSON.stringify({
      active,
      isEnabled: monitoring.isEnabled(),
      sdkInitialized: Sentry.isInitialized(),
    }));
  `;
  const result = await execFileAsync(process.execPath, ['-e', script], {
    cwd: serverRoot,
    env: { ...process.env, ...env },
  });
  return JSON.parse(result.stdout);
};

test('error tracking stays off when no DSN is configured', async () => {
  const result = await runProbe({ SENTRY_DSN: '', NODE_ENV: 'development' });
  assert.deepEqual(result, { active: false, isEnabled: false, sdkInitialized: false });
});

test('a DSN outside the test environment initialises the SDK', async () => {
  const result = await runProbe({
    SENTRY_DSN: 'https://public@example.invalid/1',
    NODE_ENV: 'production',
    SENTRY_ENVIRONMENT: 'test-suite',
  });
  assert.equal(result.active, true);
  assert.equal(result.isEnabled, true);
  assert.equal(result.sdkInitialized, true);
});

test('the test environment never reports exceptions', async () => {
  const result = await runProbe({
    SENTRY_DSN: 'https://public@example.invalid/1',
    NODE_ENV: 'test',
  });
  assert.deepEqual(result, { active: false, isEnabled: false, sdkInitialized: false });
});

test('an Express error is delivered to the configured DSN', async () => {
  // A local sink stands in for Sentry's ingest so the test proves the transport
  // works without an account or network access.
  const script = `
    const http = require('http');
    const monitoring = require('./config/monitoring');
    const received = [];
    const sink = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => { received.push(body); res.statusCode = 200; res.end(); });
    });
    sink.listen(0, () => {
      process.env.SENTRY_DSN = 'http://public@127.0.0.1:' + sink.address().port + '/1';
      const active = monitoring.initMonitoring();
      const express = require('express');
      const app = express();
      app.get('/boom', () => { throw new Error('sentry-probe-boom'); });
      app.use((error, req, res, next) => res.status(500).json({ message: error.message }));
      const server = app.listen(0, async () => {
        await new Promise((resolve, reject) => {
          http.get('http://127.0.0.1:' + server.address().port + '/boom', (response) => {
            response.resume();
            response.on('end', resolve);
          }).on('error', reject);
        });
        await monitoring.flush(5000);
        server.close();
        sink.close();
        process.stdout.write(JSON.stringify({
          active,
          count: received.length,
          delivered: received.some((body) => body.includes('sentry-probe-boom')),
        }));
      });
    });
  `;
  const result = await execFileAsync(process.execPath, ['-e', script], {
    cwd: serverRoot,
    env: { ...process.env, NODE_ENV: 'production', SENTRY_DSN: '' },
  });
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.active, true);
  assert.ok(parsed.count > 0, 'the SDK should post an envelope to the DSN host');
  assert.equal(parsed.delivered, true, 'the envelope should contain the thrown error');
});

test('a malformed DSN never takes the API down', async () => {
  // The SDK tolerates odd strings, so the guarantee is that init and capture
  // return cleanly whatever the DSN looks like.
  const result = await runProbe({ SENTRY_DSN: 'not-a-dsn', NODE_ENV: 'production' });
  assert.equal(typeof result.active, 'boolean');
  assert.equal(typeof result.isEnabled, 'boolean');
});
