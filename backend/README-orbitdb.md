# Running the backend in OrbitDB mode

This README explains how to run the DecStor backend using OrbitDB instead of MongoDB.

Prerequisites:
- Node 18+ (project uses modern ESM modules)
- No external IPFS daemon required (uses embedded ipfs-core by default)

How to start the backend in OrbitDB mode:

1. Set the service wallet mnemonic in `backend/.env` as `SERVICE_WALLET_MNEMONIC="...25 words..."` (the backend requires a service wallet).
2. Start the backend with the `USE_ORBITDB` environment variable set to `true`:

```bash
cd backend
USE_ORBITDB=true npm run dev
```

Notes:
- OrbitDB stores are created under `backend/orbitdb` by default. Use the `initOrbitDB({ repo })` option to choose a different path.
- The OrbitDB wrapper aims to be Mongo-compatible for the common operations used in DecStor. It supports:
  - find(filter) with basic equality, `$in`, `$or`, and `$regex` (simple usage)
  - findOne/filter, insertOne/insertMany, updateOne/updateMany, deleteOne/deleteMany
  - Cursor chaining: `.find(...).map(...).toArray()`

Migration from MongoDB:
- A migration script `backend/migrate-mongo-to-orbitdb.ts` is provided. It reads collections from MongoDB and inserts them into OrbitDB stores.
- Usage:

```bash
# ensure MONGO_URI is set in your environment or backend/.env
node backend/migrate-mongo-to-orbitdb.ts
```

Limitations & considerations:
- OrbitDB is eventually consistent. For multi-writer setups or multiple nodes, replication delays may be visible.
- The wrapper does not implement full Mongo query language or aggregation pipelines — only the patterns used by DecStor.

If you want help running the migration or expanding query support, I can implement the next steps.
