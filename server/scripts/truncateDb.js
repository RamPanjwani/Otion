const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function truncate() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set in environment or .env');
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to database: ${mongoose.connection.name}`);

  const collections = await mongoose.connection.db.collections();
  if (!collections.length) {
    console.log('No collections found in database.');
  }

  for (const collection of collections) {
    const count = await collection.countDocuments();
    await collection.deleteMany({});
    console.log(`- ${collection.collectionName}: cleared ${count} document(s)`);
  }

  await mongoose.disconnect();
  console.log('Database truncation completed successfully.');
}

truncate().catch((error) => {
  console.error('Truncation failed:', error);
  process.exit(1);
});
