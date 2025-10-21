import { initOrbitDB, getCollection } from './orbitdb.js';

async function findOrCreateUser(usersCol, filesCol, address, walletName) {
  let user = await usersCol.findOne({ address });
  const now = new Date().toISOString();

  if (user) {
    // recalc storageUsed from files
    const ownerFiles = await filesCol.find({ owner: address }).toArray();
    const totalSize = ownerFiles.reduce((s, f) => s + (f.size || 0), 0);
    const updates = { updatedAt: now, lastLogin: now };
    if (user.storageUsed !== totalSize) updates.storageUsed = totalSize;
    await usersCol.updateOne({ address }, { $set: updates });
    user = await usersCol.findOne({ address });
    return { ...user, storageLimit: user.storageTier === 'pro' ? 100 * 1024 * 1024 : 1 * 1024 * 1024 };
  }

  const defaultName = walletName || `Wallet ${address.substring(address.length - 4)}`;
  const newUser = { address, walletName: defaultName, storageUsed: 0, storageTier: 'free', createdAt: now, updatedAt: now, lastLogin: now, twoFactorEnabled: false, twoFactorVerified: false };
  const { insertedId } = await usersCol.insertOne(newUser);
  const created = await usersCol.findOne({ _id: insertedId });
  return { ...created, storageLimit: 1 * 1024 * 1024 };
}

async function saveFileMetadata(filesCol, usersCol, owner, metadata) {
  // ensure user exists
  const user = await usersCol.findOne({ address: owner });
  if (!user) throw new Error('Owner not found');

  // check quota
  const ownerFiles = await filesCol.find({ owner }).toArray();
  const used = ownerFiles.reduce((s, f) => s + (f.size || 0), 0);
  const limit = user.storageTier === 'pro' ? 100 * 1024 * 1024 : 1 * 1024 * 1024;
  if (used + metadata.size > limit) throw new Error('Quota exceeded');

  const { insertedId } = await filesCol.insertOne({ ...metadata, owner, createdAt: new Date().toISOString() });
  // update user's storageUsed by recalculation
  const newTotal = used + metadata.size;
  await usersCol.updateOne({ address: owner }, { $set: { storageUsed: newTotal, updatedAt: new Date().toISOString() } });
  return insertedId;
}

async function run() {
  console.log('Initializing OrbitDB for project test (repo=./orbitdb-test)...');
  await initOrbitDB({ repo: './orbitdb-test' });

  const usersCol = await getCollection('Wallets');
  const filesCol = await getCollection('files');
  const sharesCol = await getCollection('shares');
  const activitiesCol = await getCollection('activities');

  // Clean up previous test data (if any)
  const existingUsers = await usersCol.find({}).toArray();
  for (const u of existingUsers) await usersCol.deleteOne({ _id: u._id });
  const existingFiles = await filesCol.find({}).toArray();
  for (const f of existingFiles) await filesCol.deleteOne({ _id: f._id });
  const existingShares = await sharesCol.find({}).toArray();
  for (const s of existingShares) await sharesCol.deleteOne({ _id: s._id });
  const existingActivities = await activitiesCol.find({}).toArray();
  for (const a of existingActivities) await activitiesCol.deleteOne({ _id: a._id });

  // 1) Create/import a user
  const addr = 'TESTADDRESS123';
  const user = await findOrCreateUser(usersCol, filesCol, addr, 'TestWallet');
  console.log('User created/found:', user);

  // 2) Save a file under quota
  const fileMeta = { filename: 'hello.txt', cid: 'QmHello', size: 1000, fileType: 'text/plain', path: '/' };
  const fileId = await saveFileMetadata(filesCol, usersCol, addr, fileMeta);
  console.log('File saved with _id:', fileId);

  // 3) Share the file
  const share = { cid: fileMeta.cid, senderAddress: addr, recipientAddress: 'OTHERADDR', createdAt: new Date().toISOString() };
  await sharesCol.insertOne(share);
  await activitiesCol.insertOne({ owner: addr, type: 'SHARE', details: { filename: fileMeta.filename, cid: fileMeta.cid, recipient: 'OTHERADDR' }, timestamp: new Date().toISOString(), isRead: true });
  await activitiesCol.insertOne({ owner: 'OTHERADDR', type: 'SHARE', details: { filename: fileMeta.filename, cid: fileMeta.cid, recipient: 'You' }, timestamp: new Date().toISOString(), isRead: false });
  console.log('Share recorded');

  // 4) List files by owner
  const ownedFiles = await filesCol.find({ owner: addr }).toArray();
  console.log('Owned files:', ownedFiles);

  // 5) Show activities for owner
  const acts = await activitiesCol.find({ owner: addr }).toArray();
  console.log('Activities for owner:', acts);

  console.log('Project-like OrbitDB test completed successfully.');
  process.exit(0);
}

run().catch(err => { console.error('Test failed:', err); process.exit(1); });
