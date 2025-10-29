import { create as createIPFS } from 'ipfs-core';
import OrbitDB from 'orbit-db';
import { ObjectId } from 'bson';

let ipfs = null;
let orbitdb = null;
const stores = {};

export async function initOrbitDB(opts = {}) {
  if (orbitdb) return { ipfs, orbitdb };
  // Run IPFS with no swarm addresses (headless/container-friendly)
  ipfs = await createIPFS({
    repo: opts.repo || './orbitdb/ipfs',
    config: {
      Addresses: {
        Swarm: []
      }
    }
  });
  orbitdb = await OrbitDB.createInstance(ipfs, {
    directory: opts.repo ? `${opts.repo}/orbitdb` : './orbitdb/orbitdb',
  });
  return { ipfs, orbitdb };
}

export async function openCollection(name) {
  if (!orbitdb) throw new Error('OrbitDB not initialized. Call initOrbitDB() first.');
  if (stores[name]) return stores[name];
  const dbName = `DecStor.${name}`;
  const db = await orbitdb.docstore(dbName, { indexBy: '_id', accessController: { write: [orbitdb.identity.id] } });
  await db.load();
  stores[name] = db;
  return db;
}
export async function getCollection(name) {
  const db = await openCollection(name);
  const getAll = () => {
    try {
      return db.get('');
    } catch (err) {
      return [];
    }
  };

  const matchesFilter = (doc, filter) => {
    if (!filter || Object.keys(filter).length === 0) return true;

    if (filter.$or && Array.isArray(filter.$or)) {
      return filter.$or.some((sub) => matchesFilter(doc, sub));
    }

    return Object.keys(filter).every((k) => {
      const v = filter[k];
      if (k === '$or') return true;

      if (v && typeof v === 'object' && v.$regex) {
        const re = (v.$regex instanceof RegExp) ? v.$regex : new RegExp(v.$regex);
        return re.test(doc[k]);
      }

      if (v && typeof v === 'object' && v.$in) {
        const docVal = doc[k];
        if (Array.isArray(docVal)) {
          return docVal.some((el) => v.$in.includes(el));
        }
        return v.$in.includes(docVal);
      }

      return doc[k] === v;
    });
  };

  return {
    find: (filter = {}) => {
      const runQuery = () => {
        const all = getAll();
        if (!filter || Object.keys(filter).length === 0) return all;
        return all.filter((d) => matchesFilter(d, filter));
      };

      const arr = runQuery();

      const makeCursor = (items) => ({
        toArray: async () => items,
        map: (fn) => makeCursor(items.map(fn)),
        sort: (spec) => {
          const key = Object.keys(spec)[0];
          const dir = spec[key];
          const sorted = [...items].sort((a, b) => (a[key] > b[key] ? 1 : -1) * (dir === -1 ? -1 : 1));
          return makeCursor(sorted);
        }
      });

      return makeCursor(arr);
    },
    findOne: async (filter) => {
      const all = getAll();
      const found = all.find((d) => matchesFilter(d, filter || {}));
      return found || null;
    },
    insertOne: async (doc) => {
      if (!doc._id) doc._id = new ObjectId().toHexString();
      await db.put(doc);
      return { insertedId: doc._id };
    },
    insertMany: async (docs) => {
      const insertedIds = [];
      for (const d of docs) {
        if (!d._id) d._id = new ObjectId().toHexString();
        await db.put(d);
        insertedIds.push(d._id);
      }
      return { insertedIds };
    },
    updateOne: async (filter, update) => {
      // Use the same matching logic as `find()` so operators like $in and $regex work
      const runQuery = () => {
        const all = getAll();
        if (!filter || Object.keys(filter).length === 0) return all;
        return all.filter((d) => matchesFilter(d, filter));
      };

      const matched = runQuery();
      const first = matched[0];
      if (!first) return { matchedCount: 0, modifiedCount: 0 };
      const updated = { ...first, ...(update.$set || update) };
      await db.put(updated);
      return { matchedCount: 1, modifiedCount: 1 };
    },
    updateMany: async (filter, update) => {
      // Use the same runQuery as `find()` to locate matching documents
      const runQuery = () => {
        const all = getAll();
        if (!filter || Object.keys(filter).length === 0) return all;
        return all.filter((d) => matchesFilter(d, filter));
      };

      const matched = runQuery();
      for (const doc of matched) {
        const updated = { ...doc, ...(update.$set || update) };
        await db.put(updated);
      }
      return { matchedCount: matched.length, modifiedCount: matched.length };
    },
    deleteOne: async (filter) => {
      const runQuery = () => {
        const all = getAll();
        if (!filter || Object.keys(filter).length === 0) return all;
        return all.filter((d) => matchesFilter(d, filter));
      };

      const matched = runQuery();
      const first = matched[0];
      if (!first) return { deletedCount: 0 };
      await db.del(first._id);
      return { deletedCount: 1 };
    },
    deleteMany: async (filter) => {
      const runQuery = () => {
        const all = getAll();
        if (!filter || Object.keys(filter).length === 0) return all;
        return all.filter((d) => matchesFilter(d, filter));
      };

      const matched = runQuery();
      for (const d of matched) {
        await db.del(d._id);
      }
      return { deletedCount: matched.length };
    },
    createIndex: async () => ({ ok: 1 }),
    aggregateSumByOwner: async (ownerField, sizeField) => {
      const all = getAll();
      return all.reduce((acc, item) => {
        const owner = item[ownerField];
        acc[owner] = (acc[owner] || 0) + (item[sizeField] || 0);
        return acc;
      }, {});
    },
    _raw: db,
  };
}
