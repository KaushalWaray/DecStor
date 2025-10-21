import { initOrbitDB, getCollection } from './orbitdb.js';

async function run() {
  try {
    console.log('Initializing OrbitDB...');
    await initOrbitDB({ repo: './orbitdb-test' });

    console.log('Opening files collection...');
    const files = await getCollection('files');

    console.log('Inserting test document...');
    const doc = { filename: 'test.txt', cid: 'QmTestCid', size: 1234, owner: 'TESTOWNER', path: '/', createdAt: new Date().toISOString() };
    const { insertedId } = await files.insertOne(doc);
    console.log('Inserted ID:', insertedId);

    console.log('Reading back document...');
    const read = await files.findOne({ _id: insertedId });
    console.log('Read doc:', read);

    // cleanup: delete inserted doc
    await files.deleteOne({ _id: insertedId });
    console.log('Deleted test doc. Test complete.');
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

run();
