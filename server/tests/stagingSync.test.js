const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const path = require('node:path');
const { promisify } = require('node:util');
const bcrypt = require('bcryptjs');
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
const sourceUri = withDatabase(baseUri, scratchName('otion_stage_src'));
// The script warns unless the target name looks like staging.
const targetUri = withDatabase(baseUri, scratchName('otion_staging_dst'));

const sync = (from, to) => execFileAsync(
  process.execPath,
  ['scripts/syncStaging.js', '--source', from, '--target', to],
  { cwd: serverRoot, env: process.env },
);

after(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  for (const uri of [sourceUri, targetUri]) {
    const connection = await mongoose.createConnection(uri).asPromise();
    await connection.dropDatabase();
    await connection.close();
  }
});

test('a staging refresh scrubs identities and keeps the document counts', async () => {
  const source = await mongoose.createConnection(sourceUri).asPromise();
  const target = await mongoose.createConnection(targetUri).asPromise();

  try {
    const note = new mongoose.Types.ObjectId();
    const demo = new mongoose.Types.ObjectId();
    const real = new mongoose.Types.ObjectId();

    await source.collection('notes').insertOne({ _id: note, title: 'Launch checklist', content: [] });
    await source.collection('users').insertMany([
      { _id: demo, name: 'Demo Owner', email: 'demo@otion.app', password: bcrypt.hashSync('OtionDemo123!', 4), avatarUrl: '' },
      {
        _id: real,
        name: 'Real Person',
        email: 'real.person@gmail.com',
        password: bcrypt.hashSync('MyOwnPassword1!', 4),
        avatarUrl: 'https://cdn.example.com/me.png',
      },
    ]);
    await source.collection('invitations').insertOne({
      note,
      inviter: demo,
      email: 'real.person@gmail.com',
      role: 'editor',
      tokenHash: 'invitation-token-hash',
      expiresAt: new Date(Date.now() + 86_400_000),
      status: 'pending',
    });
    await source.collection('publicshares').insertOne({
      note,
      tokenHash: 'public-token-hash',
      passwordHash: 'x',
      enabled: true,
      createdBy: demo,
    });

    const result = await sync(sourceUri, targetUri);
    assert.match(result.stdout, /Staging refresh complete/);
    assert.match(result.stdout, /1 scrubbed, 1 demo accounts kept/);
    assert.match(result.stdout, /4 collections match the source counts/);

    const scrubbed = await target.collection('users').findOne({ _id: real });
    assert.equal(scrubbed.email, `user-${String(real).slice(-12)}@staging.otion.invalid`);
    assert.equal(scrubbed.name, 'Staging User');
    assert.equal(scrubbed.avatarUrl, '');
    assert.equal(await target.collection('users').countDocuments({ email: 'real.person@gmail.com' }), 0);
    assert.ok(bcrypt.compareSync('OtionStaging123!', scrubbed.password), 'shared staging password works');
    assert.ok(!bcrypt.compareSync('MyOwnPassword1!', scrubbed.password), 'the original password no longer works');

    // The documented demo login keeps working.
    const preserved = await target.collection('users').findOne({ _id: demo });
    assert.equal(preserved.email, 'demo@otion.app');
    assert.equal(preserved.name, 'Demo Owner');
    assert.ok(bcrypt.compareSync('OtionDemo123!', preserved.password));

    const invitation = await target.collection('invitations').findOne({ note });
    assert.match(invitation.email, /^invitee-[a-f0-9]{12}@staging\.otion\.invalid$/);
    assert.notEqual(invitation.tokenHash, 'invitation-token-hash');
    assert.equal(await target.collection('invitations').countDocuments({ tokenHash: 'invitation-token-hash' }), 0);

    const share = await target.collection('publicshares').findOne({ note });
    assert.notEqual(share.tokenHash, 'public-token-hash');
    assert.equal(share.passwordHash, null, 'share passwords are cleared');

    assert.equal(
      await target.collection('notes').countDocuments(),
      await source.collection('notes').countDocuments(),
      'note text is copied as-is',
    );
  } finally {
    // A failing assertion must not leave Mongo sockets keeping the runner alive.
    await source.close();
    await target.close();
  }
});

test('a refresh refuses to clear the source database', async () => {
  await assert.rejects(() => sync(sourceUri, sourceUri), /source and target are the same database/);
});
