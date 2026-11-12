/**
 * Shared logical-archive helpers.
 *
 * Documents are written as Extended JSON (relaxed: false), so ObjectIds, dates
 * and nested types survive a round trip without the MongoDB command-line tools.
 * Used by `scripts/backup.js` (backup, restore, verify) and
 * `scripts/syncStaging.js` (scrubbed production -> staging refresh).
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { pipeline } = require('node:stream/promises');
const mongoose = require('mongoose');

const { EJSON } = mongoose.mongo.BSON;

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

/** Reads an archive line by line, letting `transform` rewrite each document. */
const rewrite = async (inPath, outPath, transform) => {
  const gz = zlib.createGzip();
  const out = fs.createWriteStream(outPath);
  gz.pipe(out);
  const finished = new Promise((resolve, reject) => {
    out.on('error', reject);
    out.on('finish', resolve);
  });

  let buffer = '';
  const emit = async (line) => {
    if (!line.trim()) return;
    const parsed = EJSON.parse(line, { relaxed: false });
    const { c: name, d: document } = transform(parsed) || parsed;
    if (!gz.write(`${EJSON.stringify({ c: name, d: document }, { relaxed: false })}\n`)) {
      await new Promise((resolve) => gz.once('drain', resolve));
    }
  };

  const stream = fs.createReadStream(inPath).pipe(zlib.createGunzip({ encoding: 'utf8' }));
  for await (const chunk of stream) {
    buffer += chunk;
    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      await emit(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf('\n');
    }
  }
  await emit(buffer);
  gz.end();
  await finished;
  return outPath;
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

module.exports = { dump, restore, rewrite, countDocuments, listCollections, connection };
