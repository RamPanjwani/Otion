/**
 * Logical backups for Otion.
 *
 *   node scripts/backup.js backup --out backups/latest.json.gz
 *   node scripts/backup.js restore --in backups/latest.json.gz --target <uri>
 *   node scripts/backup.js verify [--out ...] --target <uri>
 *
 * Documents are written as Extended JSON (relaxed: false), so ObjectIds, dates
 * and nested types survive a round trip without the MongoDB command-line tools.
 * `verify` dumps the source, restores into a scratch database and compares
 * document counts per collection, which is the restore drill CI runs.
 */
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { pipeline } = require('node:stream/promises');
const mongoose = require('mongoose');

const { EJSON } = mongoose.mongo.BSON;

const args = process.argv.slice(2);
const mode = args.find((arg) => !arg.startsWith('--')) || 'backup';
const flag = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};

const isSystemCollection = (name) => name.startsWith('system.');

const listCollections = async (db) => (await db.listCollections({}, { nameOnly: true }).toArray())
  .map((collection) => collection.name)
  .filter((name) => !isSystemCollection(name))
  .sort();

const connection = async (uri) => {
  if (!uri) throw new Error('A MongoDB URI is required (MONGO_URI or --target)');
  return mongoose.createConnection(uri).asPromise();
};

const dump = async (uri, outPath) => {
  const db = (await connection(uri)).db;
  const names = await listCollections(db);
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });

  const rawPath = `${outPath}.tmp`;
  const out = fs.createWriteStream(rawPath);
  const counts = {};

  try {
    for (const name of names) {
      let count = 0;
      for await (const document of db.collection(name).find({})) {
        // Envelope each document with its collection so restore does not guess.
        const line = `${EJSON.stringify({ c: name, d: document }, { relaxed: false })}\n`;
        if (!out.write(line)) await new Promise((resolve) => out.once('drain', resolve));
        count += 1;
      }
      counts[name] = count;
    }
  } finally {
    await new Promise((resolve, reject) => out.end((error) => (error ? reject(error) : resolve())));
  }

  await pipeline(fs.createReadStream(rawPath), zlib.createGzip(), fs.createWriteStream(outPath));
  fs.rmSync(rawPath, { force: true });
  return counts;
};

const restore = async (inPath, uri) => {
  const db = (await connection(uri)).db;
  const counts = {};
  let current = null;
  let batch = [];
  let buffer = '';

  const flush = async () => {
    if (!batch.length) return;
    await db.collection(current).insertMany(batch, { ordered: false });
    counts[current] = (counts[current] || 0) + batch.length;
    batch = [];
  };

  for await (const collection of await listCollections(db)) {
    // A restore into an existing database must be repeatable.
    await db.collection(collection).deleteMany({});
  }

  const handleLine = async (line) => {
    if (!line.trim()) return;
    const { c: name, d: document } = EJSON.parse(line, { relaxed: false });
    if (name !== current) {
      await flush();
      current = name;
    }
    batch.push(document);
    if (batch.length >= 500) await flush();
  };

  const stream = fs.createReadStream(inPath).pipe(zlib.createGunzip({ encoding: 'utf8' }));
  for await (const chunk of stream) {
    buffer += chunk;
    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      await handleLine(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf('\n');
    }
  }
  await handleLine(buffer);
  await flush();

  return counts;
};

const countDocuments = async (uri) => {
  const db = (await connection(uri)).db;
  const counts = {};
  for (const name of await listCollections(db)) {
    counts[name] = await db.collection(name).countDocuments();
  }
  return counts;
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
