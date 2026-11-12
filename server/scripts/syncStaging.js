/**
 * Refresh staging from a scrubbed production dump.
 *
 *   node scripts/syncStaging.js --source <production uri> --target <staging uri>
 *   STAGING_MONGO_URI=... PRODUCTION_MONGO_URI=... npm run sync:staging
 *
 * Staging is useful only if it holds realistic data, but copying production
 * wholesale would carry real emails, password hashes, invitation tokens and
 * share links into a second environment. This dumps the source, rewrites the
 * identity-bearing fields, restores the result into the target (which clears
 * its collections first) and then proves the document counts survived.
 *
 * Every account keeps a deterministic staging address and the shared staging
 * password, except the seeded demo accounts, which keep their published
 * credentials so the documented demo login still works.
 */
require('dotenv').config();
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash, randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { dump, restore, countDocuments, rewrite } = require('./lib/archive');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};

const SOURCE = flag('source', process.env.PRODUCTION_MONGO_URI || process.env.MONGO_URI);
const TARGET = flag('target', process.env.STAGING_MONGO_URI);
const DEMO_PASSWORD = flag('demo-password', 'OtionDemo123!');
const SHARED_PASSWORD = flag('password', 'OtionStaging123!');
const KEEP_ARCHIVE = args.includes('--keep-archive');

// Seeded accounts documented in the readme; they keep their published password.
const DEMO_ACCOUNTS = new Set(['demo@otion.app', 'maya@otion.app', 'sam@otion.app']);

const describe = (uri) => {
  try {
    const url = new URL(uri);
    return { host: url.host, db: (url.pathname || '').replace(/^\//, '') || 'test' };
  } catch {
    return { host: 'unparseable', db: 'unknown' };
  }
};

const randomToken = () => createHash('sha256').update(randomBytes(32)).digest('hex');

const run = async () => {
  if (!SOURCE) throw new Error('a source is required (--source or PRODUCTION_MONGO_URI)');
  if (!TARGET) throw new Error('a target is required (--target or STAGING_MONGO_URI)');

  const from = describe(SOURCE);
  const to = describe(TARGET);
  if (from.host === to.host && from.db === to.db) {
    throw new Error(`source and target are the same database (${to.host}/${to.db}); refusing to clear it`);
  }
  if (!/stag/i.test(to.db)) {
    console.warn(`warning: target database is "${to.db}", which does not look like a staging database`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rawArchive = path.join(os.tmpdir(), `otion-staging-source-${stamp}.json.gz`);
  const scrubbedArchive = path.join(os.tmpdir(), `otion-staging-scrubbed-${stamp}.json.gz`);

  const stats = { scrubbed: 0, demoPreserved: 0, invitations: 0, publicShares: 0 };
  const sharedHash = bcrypt.hashSync(SHARED_PASSWORD, 10);
  const demoHash = bcrypt.hashSync(DEMO_PASSWORD, 10);

  try {
    const dumped = await dump(SOURCE, rawArchive);
    const dumpedTotal = Object.values(dumped).reduce((sum, count) => sum + count, 0);

    // Scrub while streaming so the unscrubbed archive never leaves this process.
    await rewrite(rawArchive, scrubbedArchive, ({ c, d }) => {
      if (c === 'users') {
        if (DEMO_ACCOUNTS.has(d.email)) {
          d.password = demoHash;
          stats.demoPreserved += 1;
        } else {
          d.email = `user-${String(d._id).slice(-12)}@staging.otion.invalid`;
          d.name = 'Staging User';
          d.password = sharedHash;
          stats.scrubbed += 1;
        }
        d.avatarUrl = '';
      } else if (c === 'invitations') {
        d.email = `invitee-${String(d._id).slice(-12)}@staging.otion.invalid`;
        d.tokenHash = randomToken();
        stats.invitations += 1;
      } else if (c === 'publicshares') {
        d.tokenHash = randomToken();
        d.passwordHash = null;
        stats.publicShares += 1;
      }
      return { c, d };
    });

    const restored = await restore(scrubbedArchive, TARGET);
    const restoredTotal = Object.values(restored).reduce((sum, count) => sum + count, 0);

    const sourceCounts = await countDocuments(SOURCE);
    const differences = Object.keys(sourceCounts)
      .filter((name) => (sourceCounts[name] || 0) !== (restored[name] || 0))
      .map((name) => `${name}: source ${sourceCounts[name] || 0}, restored ${restored[name] || 0}`);
    if (differences.length) throw new Error(`refresh changed document counts:\n${differences.join('\n')}`);

    console.log('Staging refresh complete');
    console.log(`  source      ${from.host}/${from.db} (${dumpedTotal} documents)`);
    console.log(`  target      ${to.host}/${to.db} (${restoredTotal} documents)`);
    console.log(`  accounts    ${stats.scrubbed} scrubbed, ${stats.demoPreserved} demo accounts kept with the documented password`);
    console.log(`  invitations ${stats.invitations} re-addressed and re-tokened`);
    console.log(`  share links ${stats.publicShares} re-tokened, passwords cleared`);
    console.log(`  verified    ${Object.keys(sourceCounts).length} collections match the source counts`);
    if (stats.scrubbed) {
      console.log(`  sign in     user-<id>@staging.otion.invalid with password from --password (default ${SHARED_PASSWORD})`);
    }
  } finally {
    if (KEEP_ARCHIVE) {
      console.warn(`warning: kept archives in ${os.tmpdir()} — ${rawArchive} contains unscubbed production data`);
    } else {
      fs.rmSync(rawArchive, { force: true });
      fs.rmSync(scrubbedArchive, { force: true });
    }
  }
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect().catch(() => undefined));
