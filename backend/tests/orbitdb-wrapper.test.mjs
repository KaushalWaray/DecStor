import assert from 'assert';
import { initOrbitDB, getCollection } from '../orbitdb.js';

async function run() {
  console.log('Initializing OrbitDB for tests...');
  await initOrbitDB({ repo: './orbitdb-test' });

  const col = await getCollection('testcol');

  // Clean up any existing docs
  await col.deleteMany({});

  // Insert docs
  await col.insertOne({ _id: 'a', name: 'Alice', tags: ['friend'] });
  await col.insertOne({ _id: 'b', name: 'Bob', tags: ['coworker'] });
  await col.insertOne({ _id: 'c', name: 'Charlie', tags: ['friend','gym'] });

  // Test $in
  const allDocs = await col.find({}).toArray();
  console.log('All docs in test collection:', allDocs);
  const friends = await col.find({ tags: { $in: ['friend'] } }).toArray();
  console.log('Friends result:', friends);
  assert(friends.length === 2, 'Expected 2 friends');

  // Test $or
  const orRes = await col.find({ $or: [{ name: 'Alice' }, { name: 'Bob' }] }).toArray();
  assert(orRes.length === 2, '$or should match Alice and Bob');

  // Test $regex
  const regexRes = await col.find({ name: { $regex: '^A' } }).toArray();
  assert(regexRes.length === 1 && regexRes[0].name === 'Alice', 'Regex ^A should match Alice');

  // Test cursor chaining map().toArray()
  const mapped = await col.find({}).map(d => d.name).toArray();
  assert(Array.isArray(mapped) && mapped.includes('Alice') && mapped.includes('Bob'), 'Map should return names');

  console.log('All wrapper tests passed.');
}

run().catch(err => { console.error('Tests failed:', err); process.exit(1); });
