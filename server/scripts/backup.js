/**
 * Logical backups for Otion.
 *
 *   node scripts/backup.js backup --out backups/latest.json.gz
 *   node scripts/backup.js restore --in backups/latest.json.gz --target <uri>
 *   node scripts/backup.js verify [--out ...] --target <uri>
 *
 * The dump/restore primitives live in `scripts/lib/archive.js`; `verify` dumps
 * the source, restores into a scratch database and compares document counts per
 * collection, which is the restore drill CI runs.
 */
require('dotenv').config();
const path = require('node:path');
const mongoose = require('mongoose');

const { dump, restore, countDocuments } = require('./lib/archive');

const args = process.argv.slice(2);
const mode = args.find((arg) => !arg.startsWith('--')) || 'backup';
const flag = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};

const compare = (expected, actual) => {
  const differences = [];
  for (const name of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
    if ((expected[name] || 0) !== (actual[name] || 0)) {
      differences.push(`${name}: source ${expected[name] || 0}, restored ${actual[name] || 0}`);
    }
  }
  return differences;
};

const run = async () => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const source = process.env.MONGO_URI;

  if (mode === 'backup') {
    const outPath = flag('out') || path.join('backups', `otion-${stamp}.json.gz`);
    const counts = await dump(source, outPath);
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    console.log(`Backed up ${total} documents from ${Object.keys(counts).length} collections to ${outPath}`);
    for (const [name, count] of Object.entries(counts)) console.log(`  ${name}: ${count}`);
    return;
  }

  const inPath = flag('in') || flag('out');
  const target = flag('target');
  if (!target) throw new Error(`${mode} needs --target <MONGO URI>`);

  let archive = inPath;
  if (!archive) {
    // Without an archive, verify dumps a fresh one so the drill exercises the backup path.
    archive = path.join(require('node:os').tmpdir(), `otion-verify-${stamp}.json.gz`);
    const dumped = await dump(source, archive);
    console.log(`Dumped ${Object.keys(dumped).length} collections to ${archive}`);
  }

  const restored = await restore(archive, target);
  const restoredTotal = Object.values(restored).reduce((sum, count) => sum + count, 0);
  console.log(`Restored ${restoredTotal} documents into ${target}`);

  if (mode === 'verify') {
    const sourceCounts = await countDocuments(source);
    const differences = compare(sourceCounts, await countDocuments(target));
    if (differences.length) {
      throw new Error(`Restore verification failed:\n${differences.join('\n')}`);
    }
    console.log(`Verified ${Object.keys(sourceCounts).length} collections match the source`);
  }
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect().catch(() => undefined));
