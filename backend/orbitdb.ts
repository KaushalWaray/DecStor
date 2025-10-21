// backend/orbitdb.ts
// Minimal OrbitDB wrapper for DecStor backend
// - initOrbitDB(): starts IPFS + OrbitDB
// - getCollection(name): returns a Mongo-like wrapper around an orbit-db docstore
//
// Note: this file is designed for the backend TypeScript environment.
// @ts-nocheck

import { create as createIPFS } from 'ipfs-core';
import OrbitDB from 'orbit-db';
import * as docstore from 'orbit-db-docstore';
import { ObjectId } from 'bson';

type Doc = Record<string, any>;

let ipfs: any = null;
let orbitdb: any = null;
const stores: Record<string, any> = {};

/**
 * Initialize IPFS and OrbitDB. Call once at backend startup.
 * @param opts.repo optional repo path for ipfs
 */
export async function initOrbitDB(opts: { repo?: string } = {}) {
  if (orbitdb) return { ipfs, orbitdb };

  // Run IPFS with no swarm addresses (headless/container-friendly)
  ipfs = await createIPFS({
    repo: opts.repo || './orbitdb/ipfs',
    config: {
      Addresses: { Swarm: [] }
    }
  });

  // Create OrbitDB instance
  orbitdb = await OrbitDB.createInstance(ipfs, {
    // identity can be configured here if you want a persistent identity
    directory: opts.repo ? `${opts.repo}/orbitdb` : './orbitdb/orbitdb',
  });

  return { ipfs, orbitdb };
}

/**
 * Open or create a docstore for `name`. Index docs by `_id`.
 */
export async function openCollection(name: string) {
  if (!orbitdb) throw new Error('OrbitDB not initialized. Call initOrbitDB() first.');
  if (stores[name]) return stores[name];

  const dbName = `DecStor.${name}`;
  // accessController.write set to [orbitdb.identity.id] by default: single-writer backend
  const db = await orbitdb.docstore(dbName, { indexBy: '_id', accessController: { write: [orbitdb.identity.id] } });
  await db.load();
  stores[name] = db;
  return db;
}

/**
 * Return a Mongo-like collection wrapper for the given collection name.
 * Methods implemented (async):
 * - find(filter = {})
 * - findOne(filter)
 * - insertOne(doc)
 * - insertMany(docs)
 * - updateOne(filter, updateObj)
 * - updateMany(filter, updateObj)
 * - deleteOne(filter)
 * - deleteMany(filter)
 * - createIndex(...): compatibility stub
 * - aggregateSumByOwner(ownerField, sizeField): small helper used by the backend
 */
export async function getCollection(name: string) {
  const db = await openCollection(name);

  // helper to get all docs
  const getAll = () => {
    // docstore.get can accept string or function; using empty string to request all docs
    try {
      return db.get('');
    } catch (err) {
      // fallback: db.query or db.iterator depending on docstore version
      // Try to read internal store if needed
      return [];
    }
  };

  // helper to test a single document against a filter
  const matchesFilter = (doc: Doc, filter: Record<string, any>) => {
    if (!filter || Object.keys(filter).length === 0) return true;

    // $or support: array of sub-filters
    if (filter.$or && Array.isArray(filter.$or)) {
      return filter.$or.some((sub: Record<string, any>) => matchesFilter(doc, sub));
    }

    return Object.keys(filter).every((k) => {
      const v = filter[k];
      if (k === '$or') return true; // already handled

      // support regex: { field: { $regex: /pattern/ } } or string pattern
      if (v && typeof v === 'object' && v.$regex) {
        const re = (v.$regex instanceof RegExp) ? v.$regex : new RegExp(v.$regex);
        return re.test(doc[k]);
      }

      // support $in operator, handling case where doc[k] is an array
      if (v && typeof v === 'object' && v.$in) {
        const docVal = doc[k];
        if (Array.isArray(docVal)) {
          return docVal.some((el: any) => v.$in.includes(el));
        }
        return v.$in.includes(docVal);
      }

      return doc[k] === v;
    });
  };

  return {
    find: (filter: Record<string, any> = {}) => {
      const runQuery = () => {
        const all: Doc[] = getAll() || [];
        if (!filter || Object.keys(filter).length === 0) return all;
        return all.filter((d: Doc) => matchesFilter(d, filter));
      };

      const arr = runQuery();

      const makeCursor = (items: any[]) => ({
        toArray: async () => items,
        map: (fn: any) => makeCursor(items.map(fn)),
        sort: (spec: any) => {
          const key = Object.keys(spec)[0];
          const dir = spec[key];
          const sorted = [...items].sort((a, b) => (a[key] > b[key] ? 1 : -1) * (dir === -1 ? -1 : 1));
          return makeCursor(sorted);
        }
      });

      return makeCursor(arr);
    },

    findOne: async (filter: Record<string, any>) => {
      const all: Doc[] = getAll();
      const found = all.find((d: Doc) => matchesFilter(d, filter || {}));
      return found || null;
    },

    insertOne: async (doc: Doc) => {
      if (!doc._id) doc._id = new ObjectId().toHexString();
      await db.put(doc);
      return { insertedId: doc._id };
    },

    insertMany: async (docs: Doc[]) => {
      const insertedIds: string[] = [];
      for (const d of docs) {
        if (!d._id) d._id = new ObjectId().toHexString();
        await db.put(d);
        insertedIds.push(d._id);
      }
      return { insertedIds };
    },

    updateOne: async (filter: Record<string, any>, update: any) => {
      const all = getAll();
      const found = all.find((d: Doc) => Object.keys(filter).every(k => d[k] === filter[k]));
      if (!found) return { matchedCount: 0, modifiedCount: 0 };
      const updated = { ...found, ...(update.$set || update) };
      await db.put(updated);
      return { matchedCount: 1, modifiedCount: 1 };
    },

    updateMany: async (filter: Record<string, any>, update: any) => {
      const all = getAll();
      const matched = all.filter((d: Doc) => Object.keys(filter).every(k => d[k] === filter[k]));
      for (const doc of matched) {
        const updated = { ...doc, ...(update.$set || update) };
        await db.put(updated);
      }
      return { matchedCount: matched.length, modifiedCount: matched.length };
    },

    deleteOne: async (filter: Record<string, any>) => {
      const all = getAll();
      const found = all.find((d: Doc) => Object.keys(filter).every(k => d[k] === filter[k]));
      if (!found) return { deletedCount: 0 };
      await db.del(found._id);
      return { deletedCount: 1 };
    },

    deleteMany: async (filter: Record<string, any>) => {
      const all = getAll();
      const toDelete = all.filter((d: Doc) => Object.keys(filter).every(k => d[k] === filter[k]));
      for (const d of toDelete) {
        await db.del(d._id);
      }
      return { deletedCount: toDelete.length };
    },

    createIndex: async (..._args: any[]) => {
      // Docstore has limited indexing; implement uniqueness checks at insert time.
      return { ok: 1 };
    },

    // simple helper used by backend to compute total file size per owner
    aggregateSumByOwner: async (ownerField: string, sizeField: string) => {
      const all = getAll();
      return all.reduce((acc: Record<string, number>, item: any) => {
        const owner = item[ownerField];
        acc[owner] = (acc[owner] || 0) + (item[sizeField] || 0);
        return acc;
      }, {});
    },

    // Expose the raw docstore if caller needs low-level operations
    _raw: db,
  };
}
