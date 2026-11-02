require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const dryRun = process.argv.includes('--dry-run');

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI must be configured');
  await mongoose.connect(process.env.MONGO_URI);
  const migrations = mongoose.connection.collection('_migrations');
  await migrations.createIndex({ id: 1 }, { unique: true });
  const applied = new Set((await migrations.find({}).project({ id: 1 }).toArray()).map((item) => item.id));
  const files = fs.readdirSync(__dirname)
    .filter((file) => /^\d+.*\.js$/.test(file))
    .sort();

  for (const file of files) {
    const migration = require(path.join(__dirname, file));
    if (applied.has(migration.id)) {
      console.log(`skip ${migration.id}`);
      continue;
    }
    console.log(`${dryRun ? 'check' : 'apply'} ${migration.id}: ${migration.description}`);
    await migration.up({ mongoose, dryRun });
    if (!dryRun) await migrations.insertOne({ id: migration.id, appliedAt: new Date() });
  }
};

run()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error(error.message);
    await mongoose.disconnect().catch(() => undefined);
    process.exitCode = 1;
  });
