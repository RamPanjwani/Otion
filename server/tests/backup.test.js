const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const mongoose = require('mongoose');

require('dotenv').config();

const execFileAsync = promisify(execFile);
const serverRoot = path.join(__dirname, '..');
const baseUri = process.env.TEST_MONGO_URI || process.env.MONGO_URI;
if (!baseUri) throw new Error('TEST_MONGO_URI or MONGO_URI must be configured');

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
const sourceUri = withDatabase(baseUri, scratchName('otion_backup_src'));
const targetUri = withDatabase(baseUri, scratchName('otion_backup_dst'));
const archive = path.join(os.tmpdir(), `otion-backup-test-${Date.now()}.json.gz`);

const runScript = (mode, extraArgs, uri) => execFileAsync(
  process.execPath,
  ['scripts/backup.js', mode, ...extraArgs],
  { cwd: serverRoot, env: { ...process.env, MONGO_URI: uri } },
);

const sampleDocuments = () => [
  {
    _id: new mongoose.Types.ObjectId(),
    title: 'Launch checklist',
    createdAt: new Date('2026-03-04T05:06:07.800Z'),
    tags: ['launch', 'ops'],
    blocks: [{ id: 'b1', type: 'paragraph', text: 'Ship it' }],
    meta: { owner: new mongoose.Types.ObjectId(), archived: false, score: null },
  },
  {
    _id: new mongoose.Types.ObjectId(),
    title: 'Public onboarding guide',
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    tags: [],
    blocks: [],
    meta: { owner: new mongoose.Types.ObjectId(), archived: true, score: 4.5 },
  },
];

after(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  fs.rmSync(archive, { force: true });
  for (const uri of [sourceUri, targetUri]) {
    const connection = await mongoose.createConnection(uri).asPromise();
    await connection.dropDatabase();
    await connection.close();
  }
});

test('a backup restores every collection with its BSON types intact', async () => {
  const source = await mongoose.createConnection(sourceUri).asPromise();
  const notes = sampleDocuments();
  await source.collection('notes').insertMany(notes);
  await source.collection('users').insertOne({
    _id: new mongoose.Types.ObjectId(),
    email: 'backup@otion.app',
    createdAt: new Date('2026-02-02T02:02:02.000Z'),
  });

  const target = await mongoose.createConnection(targetUri).asPromise();
  // A stale document proves the restore clears what it is about to replace.
  await target.collection('notes').insertOne({ title: 'stale' });

  const dump = await runScript('backup', ['--out', archive], sourceUri);
  assert.match(dump.stdout, /Backed up 3 documents from 2 collections/);

  const restored = await runScript('restore', ['--in', archive, '--target', targetUri], sourceUri);
  assert.match(restored.stdout, /Restored 3 documents/);

  const restoredNotes = await target.collection('notes').find({}).sort({ title: 1 }).toArray();
  assert.equal(restoredNotes.length, 2);
  const expected = [...notes].sort((a, b) => a.title.localeCompare(b.title));
  assert.deepEqual(restoredNotes, expected);
  assert.ok(restoredNotes[0].createdAt instanceof Date, 'dates survive the round trip');
  assert.ok(restoredNotes[0]._id instanceof mongoose.mongo.ObjectId, 'ids survive the round trip');
  assert.ok(restoredNotes[0].meta.owner instanceof mongoose.mongo.ObjectId, 'nested ids survive');

  const verified = await runScript('verify', ['--target', targetUri], sourceUri);
  assert.match(verified.stdout, /Verified 2 collections match the source/);

  await source.close();
  await target.close();
});
