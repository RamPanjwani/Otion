const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');
const mongoose = require('mongoose');

require('dotenv').config();

const execFileAsync = promisify(execFile);
const serverRoot = path.join(__dirname, '..');
const migrationsDir = path.join(serverRoot, 'migrations');
const baseUri = process.env.TEST_MONGO_URI || process.env.MONGO_URI;

if (!baseUri) throw new Error('TEST_MONGO_URI or MONGO_URI must be configured');

const migrationIds = fs.readdirSync(migrationsDir)
  .filter((file) => /^\d+.*\.js$/.test(file))
  .sort()
  .map((file) => require(path.join(migrationsDir, file)).id);

// Swap the database segment while keeping credentials and query options intact.
const withDatabase = (uri, name) => {
  const [beforeQuery, ...queryParts] = uri.split('?');
  const query = queryParts.length ? `?${queryParts.join('?')}` : '';
  const authorityEnd = beforeQuery.indexOf('//') + 2;
  const pathStart = beforeQuery.indexOf('/', authorityEnd);
  const authority = pathStart === -1 ? beforeQuery : beforeQuery.slice(0, pathStart);
  return `${authority}/${name}${query}`;
};

const scratchName = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;

const runMigration = async (uri, extraArgs = []) => execFileAsync(
  process.execPath,
  ['migrations/runner.js', ...extraArgs],
  { cwd: serverRoot, env: { ...process.env, MONGO_URI: uri } },
);

const ledgerEntries = async (uri) => {
  const connection = await mongoose.createConnection(uri).asPromise();
  try {
    const collection = connection.collection('_migrations');
    const documents = await collection.find({}).sort({ id: 1 }).toArray();
    const indexes = await collection.indexes();
    return { documents, indexes };
  } finally {
    await connection.close();
  }
};

const appliedDatabase = withDatabase(baseUri, scratchName('otion_migrations'));
const dryRunDatabase = withDatabase(baseUri, scratchName('otion_migrations_dry'));
const checkDatabase = withDatabase(baseUri, scratchName('otion_migrations_check'));
const databases = [appliedDatabase, dryRunDatabase, checkDatabase];

after(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  for (const uri of databases) {
    const connection = await mongoose.createConnection(uri).asPromise();
    await connection.dropDatabase();
    await connection.close();
  }
});

test('the migration runner applies every migration exactly once', async () => {
  assert.ok(migrationIds.length > 0, 'expected migration files to exist');

  const first = await runMigration(appliedDatabase);
  for (const id of migrationIds) {
    assert.match(first.stdout, new RegExp(`apply ${id}:`), `migration ${id} should have been applied`);
  }
  assert.doesNotMatch(first.stdout, /^skip /m, 'a fresh database should not skip migrations');

  const { documents, indexes } = await ledgerEntries(appliedDatabase);
  assert.deepEqual(documents.map((document) => document.id), migrationIds);
  assert.ok(documents.every((document) => document.appliedAt instanceof Date));
  assert.ok(
    indexes.some((index) => index.unique && index.key?.id === 1),
    'the ledger should have a unique index on id',
  );

  const second = await runMigration(appliedDatabase);
  assert.doesNotMatch(second.stdout, /^apply /m, 'a second run must not reapply migrations');
  assert.match(second.stdout, new RegExp(`skip ${migrationIds[0]}`));
  const afterSecond = await ledgerEntries(appliedDatabase);
  assert.deepEqual(afterSecond.documents.map((document) => document.id), migrationIds);
});

test('--dry-run reports pending migrations without recording them', async () => {
  const result = await runMigration(dryRunDatabase, ['--dry-run']);
  for (const id of migrationIds) {
    assert.match(result.stdout, new RegExp(`check ${id}:`), `migration ${id} should have been checked`);
  }
  assert.doesNotMatch(result.stdout, /apply /, 'a dry run must not apply migrations');

  const { documents } = await ledgerEntries(dryRunDatabase);
  assert.equal(documents.length, 0, 'a dry run must not write to the ledger');
});

test('--check fails while migrations are pending and passes once they are applied', async () => {
  const pending = await runMigration(checkDatabase, ['--check']).then(() => null, (error) => error);
  assert.ok(pending, 'a database with pending migrations should fail the check');
  for (const id of migrationIds) {
    assert.match(pending.stdout, new RegExp(`check ${id}:`));
  }
  assert.match(`${pending.stdout}${pending.stderr}`, /Pending migrations: \d+/);

  const { documents } = await ledgerEntries(checkDatabase);
  assert.equal(documents.length, 0, '--check must not record migrations');

  await runMigration(checkDatabase);
  const clean = await runMigration(checkDatabase, ['--check']);
  assert.doesNotMatch(clean.stdout, /^check /m, 'nothing should be pending after applying');
  assert.doesNotMatch(clean.stdout, /^apply /m);
});

test('the runner refuses to start without MONGO_URI', async () => {
  // Run outside the server directory so dotenv cannot refill MONGO_URI from .env.
  const environment = { ...process.env };
  delete environment.MONGO_URI;
  const child = await execFileAsync(process.execPath, [path.join(migrationsDir, 'runner.js')], {
    cwd: require('node:os').tmpdir(),
    env: environment,
  }).then(() => null, (error) => error);
  assert.ok(child, 'the runner should exit non-zero without MONGO_URI');
  assert.match(`${child.stdout}${child.stderr}`, /MONGO_URI must be configured/);
});
