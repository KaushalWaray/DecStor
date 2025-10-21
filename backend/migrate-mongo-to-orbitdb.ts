import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { initOrbitDB, getCollection } from './orbitdb.js';

// Simple migration script: copies documents from MongoDB collections into OrbitDB docstores
// Usage: node migrate-mongo-to-orbitdb.js

async function migrate() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('MONGO_URI not set; aborting migration.');
    process.exit(1);
  }

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db('DecStor');

  console.log('Initializing OrbitDB...');
  await initOrbitDB({ repo: './orbitdb-migration' });

  const collectionsToCopy = ['Wallets', 'files', 'shares', 'folders', 'activities', 'contacts'];

  for (const name of collectionsToCopy) {
    console.log(`Migrating collection ${name}...`);
    const mongoCol = db.collection(name);
    const docs = await mongoCol.find({}).toArray();
    const orbitCol = await getCollection(name);

    let count = 0;
    for (const d of docs) {
      // preserve _id as hex string
      const doc = { ...d, _id: d._id ? d._id.toString() : undefined };
      await orbitCol.insertOne(doc);
      count++;
    }
    console.log(`  -> migrated ${count} documents into OrbitDB store ${name}`);
  }

  await client.close();
  console.log('Migration complete.');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
