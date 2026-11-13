const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { createHash } = require('node:crypto');
const path = require('node:path');
const { promisify } = require('node:util');
const mongoose = require('mongoose');

require('dotenv').config();

const execFileAsync = promisify(execFile);
const serverRoot = path.join(__dirname, '..');
const baseUri = process.env.TEST_MONGO_URI || process.env.MONGO_URI;

if (!baseUri) throw new Error('TEST_MONGO_URI or MONGO_URI must be configured');

const withDatabase = (uri, name) => {
  const [beforeQuery, ...queryParts] = uri.split('?');
  const query = queryParts.length ? `?${queryParts.join('?')}` : '';
  const authorityEnd = beforeQuery.indexOf('//') + 2;
  const pathStart = beforeQuery.indexOf('/', authorityEnd);
  const authority = pathStart === -1 ? beforeQuery : beforeQuery.slice(0, pathStart);
  return `${authority}/${name}${query}`;
};

const databaseUri = withDatabase(
  baseUri,
  `otion_seed_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`,
);

let connection;

before(async () => {
  connection = await mongoose.createConnection(databaseUri).asPromise();
});

after(async () => {
  if (connection) {
    await connection.dropDatabase();
    await connection.close();
  }
});

const runSeed = async () => {
  const result = await execFileAsync(process.execPath, ['scripts/seed.js'], {
    cwd: serverRoot,
    env: { ...process.env, MONGO_URI: databaseUri, CLIENT_URL: 'http://localhost:5173' },
  });
  return result.stdout;
};

const snapshot = async () => {
  const collection = (name) => connection.collection(name);
  const [users, notes, shares, preferences, revisions, comments, notifications, publicShares] = await Promise.all([
    collection('users').find({}).toArray(),
    collection('notes').find({}).toArray(),
    collection('sharepermissions').countDocuments(),
    collection('usernotepreferences').find({}).toArray(),
    collection('noterevisions').countDocuments(),
    collection('comments').find({}).toArray(),
    collection('notifications').find({}).toArray(),
    collection('publicshares').find({}).toArray(),
  ]);

  return {
    users: users.map((user) => user.email).sort(),
    passwordsAreHashed: users.every((user) => user.password !== 'OtionDemo123!' && user.password.length > 30),
    notes,
    shares,
    preferences,
    revisions,
    comments,
    notifications,
    publicShares,
  };
};

test('the seed script builds the documented demo notes and is idempotent', async () => {
  const firstRun = await runSeed();
  assert.match(firstRun, /Seed complete/);
  assert.doesNotMatch(firstRun, /Removed previous demo data/, 'a clean database has nothing to purge');

  const first = await snapshot();

  assert.deepEqual(first.users, ['demo@otion.app', 'maya@otion.app', 'sam@otion.app']);
  assert.ok(first.passwordsAreHashed, 'seeded passwords should be stored as hashes');

  assert.equal(first.notes.length, 8, 'seven owner notes plus one note owned by Maya');
  assert.equal(first.notes.filter((note) => note.isArchived).length, 1);
  assert.equal(first.notes.filter((note) => note.isPublished).length, 1);
  assert.ok(first.notes.every((note) => note.contentSchemaVersion === 3));
  assert.ok(first.notes.every((note) => note.content.length > 0));

  assert.equal(first.shares, 7);
  assert.equal(first.preferences.length, 8);
  const sortOrders = first.preferences.map((preference) => preference.sortOrder).sort((left, right) => left - right);
  assert.deepEqual(sortOrders, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(first.preferences.filter((preference) => preference.favorite).length, 2);

  assert.equal(first.revisions, 9);
  assert.equal(first.comments.length, 1);
  assert.equal(first.comments[0].blockId, 'design-p1');
  assert.equal(first.comments[0].mentions.length, 1);
  assert.deepEqual(first.notifications.map((notification) => notification.type).sort(), ['mention', 'share']);
  assert.equal(first.publicShares.length, 1);
  assert.ok(first.publicShares[0].enabled);

  const tokenHash = first.publicShares[0].tokenHash;
  assert.equal(tokenHash.length, 64, 'public tokens are stored as SHA-256 hashes');
  const printedToken = firstRun.match(/Public link: http:\/\/localhost:5173\/public\/([A-Za-z0-9_-]{40,})/)[1];
  assert.equal(
    createHash('sha256').update(printedToken).digest('hex'),
    tokenHash,
    'the printed link must be the pre-image of the stored hash',
  );
  assert.ok(!firstRun.includes(tokenHash), 'the stored hash must never be printed');

  const secondRun = await runSeed();
  assert.match(secondRun, /Removed previous demo data: 3 account\(s\), 8 note\(s\)/);

  const second = await snapshot();
  assert.deepEqual(second.users, first.users);
  assert.equal(second.notes.length, first.notes.length);
  assert.equal(second.shares, first.shares);
  assert.equal(second.preferences.length, first.preferences.length);
  assert.equal(second.revisions, first.revisions);
  assert.equal(second.comments.length, first.comments.length);
  assert.equal(second.notifications.length, first.notifications.length);
  assert.equal(second.publicShares.length, first.publicShares.length);
});
