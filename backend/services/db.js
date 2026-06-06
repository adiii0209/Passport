/**
 * MongoDB Connection Service
 * Singleton connection pool for the passport-extractor database
 */

const { MongoClient } = require('mongodb');

let client = null;
let db = null;

/**
 * Connect to MongoDB and return the database instance.
 * Reuses existing connection if already connected.
 */
async function connectDb() {
  if (db) return db;

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB_NAME || 'passport-extractor';

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);

  // Create indexes for portal lookups
  await db.collection('portals').createIndex({ slug: 1 }, { unique: true });
  await db.collection('portals').createIndex({ isActive: 1 });

  console.log(`🗄️  MongoDB connected: ${dbName}`);
  return db;
}

/**
 * Get the database instance (must call connectDb first).
 */
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call connectDb() first.');
  }
  return db;
}

/**
 * Gracefully close the MongoDB connection.
 */
async function closeDb() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('🗄️  MongoDB connection closed');
  }
}

module.exports = {
  connectDb,
  getDb,
  closeDb,
};
