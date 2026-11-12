/**
 * Load and soak testing for the Otion API.
 *
 *   node scripts/loadtest.js --base http://127.0.0.1:5000 --users 10 --duration 20
 *   node scripts/loadtest.js --base https://otion-api-staging.onrender.com --users 5 --duration 60
 *
 * Each virtual user registers its own account (or signs in with `--password` if
 * the account already exists), warms up with a few notes, then loops over the
 * real read/write paths until the deadline. Latency percentiles, throughput and
 * the status mix are printed, and `--json <path>` writes the same numbers for
 * comparison between runs. Exits non-zero when the error share exceeds
 * `--max-error-rate`, so it can gate a deploy.
 *
 * Rate limits: production allows 500 API and 30 auth requests per 15 minutes.
 * Start the target with a higher API_RATE_LIMIT / AUTH_RATE_LIMIT, or the run
 * measures the limiter rather than the API.
 */
require('dotenv').config();

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};

const BASE = String(flag('base', process.env.LOAD_TARGET || 'http://127.0.0.1:5000')).replace(/\/+$/, '');
const USERS = Number(flag('users', 10));
const DURATION = Number(flag('duration', 20));
const PASSWORD = flag('password', 'OtionLoad123!');
const MAX_ERROR_RATE = Number(flag('max-error-rate', 0.01));
const JSON_OUT = flag('json');
const NOTES_PER_USER = Number(flag('notes-per-user', 3));
// Notes created by a run are deleted afterwards so repeat runs stay comparable.
const KEEP = args.includes('--keep');

const RUN = Date.now().toString(36);
const HEADERS = { 'content-type': 'application/json' };

const percentile = (sorted, fraction) => {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return sorted[index];
};

const round = (value) => Math.round(value * 10) / 10;

const request = async (path, { method = 'GET', token, body } = {}) => {
  const started = performance.now();
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...HEADERS, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    ms: performance.now() - started,
    json: text ? JSON.parse(text) : null,
  };
};

const register = async (index) => {
  const email = `load-${RUN}-${index}@otion.invalid`;
  const created = await request('/api/auth/register', {
    method: 'POST',
    body: { name: `Load User ${index}`, email, password: PASSWORD },
  });
  if (created.status === 201) return { email, token: created.json.token };
  // A repeated run reuses the account rather than failing.
  const signedIn = await request('/api/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
  if (signedIn.status !== 200) {
    throw new Error(`could not create or sign in ${email}: ${created.status}/${signedIn.status} ${JSON.stringify(signedIn.json)}`);
  }
  return { email, token: signedIn.json.token };
};

const noteBody = (index, iteration) => ({
  title: `Load note ${index}-${iteration}`,
  content: [
    { id: 'load-h1', type: 'h2', text: `Iteration ${iteration}` },
    { id: 'load-p1', type: 'paragraph', text: 'The quick brown fox jumps over the lazy dog. '.repeat(20) },
  ],
});

// Weighted so reads dominate, like real traffic.
const PLAN = [
  { name: 'notes.list', weight: 4 },
  { name: 'notes.get', weight: 3 },
  { name: 'notes.create', weight: 2 },
  { name: 'notes.update', weight: 3 },
];

const pickOperation = () => {
  const total = PLAN.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of PLAN) {
    roll -= item.weight;
    if (roll <= 0) return item.name;
  }
  return PLAN[0].name;
};

const run = async () => {
  const health = await request('/api/health');
  if (health.status !== 200 || health.json?.status !== 'ok') {
    throw new Error(`target is not ready: ${health.status} ${JSON.stringify(health.json)}`);
  }

  console.log(`Load test against ${BASE}`);
  console.log(`  creating ${USERS} virtual users…`);
  const users = [];
  for (let index = 0; index < USERS; index += 1) users.push(await register(index));

  console.log('  warming up…');
  for (const [index, user] of users.entries()) {
    user.notes = [];
    for (let n = 0; n < NOTES_PER_USER; n += 1) {
      const created = await request('/api/notes', { method: 'POST', token: user.token, body: noteBody(index, `warm-${n}`) });
      if (created.status !== 201) throw new Error(`warm-up note failed: ${created.status} ${JSON.stringify(created.json)}`);
      user.notes.push(created.json._id);
    }
  }

  const samples = [];
  const byOperation = new Map();
  const errors = [];
  let stopAt = performance.now() + DURATION * 1000;
  const startedAt = performance.now();

  const record = (operation, sample) => {
    samples.push(sample.ms);
    const entry = byOperation.get(operation) || { count: 0, failures: 0, latencies: [] };
    entry.count += 1;
    entry.latencies.push(sample.ms);
    if (sample.status >= 400) {
      entry.failures += 1;
      if (errors.length < 10) errors.push({ operation, status: sample.status, body: sample.json });
    }
    byOperation.set(operation, entry);
  };

  const work = async (user, index) => {
    let iteration = 0;
    while (performance.now() < stopAt) {
      const operation = pickOperation();
      iteration += 1;
      try {
        if (operation === 'notes.list') {
          record(operation, await request('/api/notes', { token: user.token }));
        } else if (operation === 'notes.get') {
          const id = user.notes[iteration % user.notes.length];
          record(operation, await request(`/api/notes/${id}`, { token: user.token }));
        } else if (operation === 'notes.create') {
          const created = await request('/api/notes', { method: 'POST', token: user.token, body: noteBody(index, iteration) });
          record(operation, created);
          if (created.status === 201) user.notes.push(created.json._id);
        } else {
          const id = user.notes[iteration % user.notes.length];
          record(operation, await request(`/api/notes/${id}`, {
            method: 'PUT',
            token: user.token,
            body: { content: noteBody(index, iteration).content, saveReason: 'autosave' },
          }));
        }
      } catch (error) {
        if (errors.length < 10) errors.push({ operation, status: 'network', body: error.message });
        samples.push(0);
        const entry = byOperation.get(operation) || { count: 0, failures: 0, latencies: [] };
        entry.count += 1;
        entry.failures += 1;
        byOperation.set(operation, entry);
      }
    }
  };

  await Promise.all(users.map((user, index) => work(user, index)));
  const elapsed = (performance.now() - startedAt) / 1000;
  stopAt = 0;

  // Cleanup is outside the timed window and only touches notes this run created.
  let cleaned = 0;
  if (!KEEP) {
    for (const user of users) {
      for (const id of new Set(user.notes)) {
        const removed = await request(`/api/notes/${id}`, { method: 'DELETE', token: user.token });
        if (removed.status === 200) cleaned += 1;
      }
    }
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const total = samples.length;
  const failures = [...byOperation.values()].reduce((sum, entry) => sum + entry.failures, 0);
  const errorRate = total ? failures / total : 1;

  const summary = {
    target: BASE,
    users: USERS,
    durationSeconds: round(elapsed),
    requests: total,
    throughput: round(total / elapsed),
    failures,
    errorRate: Math.round(errorRate * 10_000) / 10_000,
    latency: {
      p50: round(percentile(sorted, 0.5)),
      p95: round(percentile(sorted, 0.95)),
      p99: round(percentile(sorted, 0.99)),
      max: round(sorted[sorted.length - 1] || 0),
    },
    operations: Object.fromEntries([...byOperation.entries()].map(([name, entry]) => {
      const latencies = [...entry.latencies].sort((a, b) => a - b);
      return [name, {
        count: entry.count,
        failures: entry.failures,
        p95: round(percentile(latencies, 0.95)),
      }];
    })),
    errors,
  };

  console.log(`\n  requests     ${summary.requests} in ${summary.durationSeconds}s (${summary.throughput} req/s)`);
  console.log(`  failures     ${summary.failures} (${round(summary.errorRate * 100)}%)`);
  console.log(`  latency      p50 ${summary.latency.p50}ms   p95 ${summary.latency.p95}ms   p99 ${summary.latency.p99}ms   max ${summary.latency.max}ms`);
  for (const [name, entry] of Object.entries(summary.operations)) {
    console.log(`    ${name.padEnd(14)} ${String(entry.count).padStart(5)} req   p95 ${entry.p95}ms${entry.failures ? `   ${entry.failures} failed` : ''}`);
  }
  for (const error of summary.errors) console.log(`    ! ${error.operation} ${error.status}: ${JSON.stringify(error.body).slice(0, 200)}`);
  if (!KEEP) console.log(`  cleaned up  ${cleaned} notes`);

  if (JSON_OUT) {
    require('node:fs').writeFileSync(JSON_OUT, `${JSON.stringify(summary, null, 2)}\n`);
    console.log(`\n  results written to ${JSON_OUT}`);
  }

  if (errorRate > MAX_ERROR_RATE) {
    throw new Error(`error rate ${round(errorRate * 100)}% exceeds the ${round(MAX_ERROR_RATE * 100)}% limit`);
  }
};

run().catch((error) => {
  console.error(`\nLoad test failed: ${error.message}`);
  process.exitCode = 1;
});
