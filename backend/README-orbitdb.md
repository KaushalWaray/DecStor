# Running the backend in OrbitDB mode

This README explains how to run the DecStor backend using OrbitDB instead of MongoDB.

Prerequisites:
- Node 18+ (project uses modern ESM modules)
- No external IPFS daemon required (uses embedded ipfs-core by default)

How to start the backend (OrbitDB-only):

1. Set the service wallet mnemonic in `backend/.env` as `SERVICE_WALLET_MNEMONIC="...25 words..."` (the backend requires a service wallet).
2. Start the backend (OrbitDB is now the default and only supported DB):

```bash
cd backend
npm run dev
```

Before starting the backend, export your Pinata JWT (used when the backend proxies file uploads to Pinata):

```bash
export PINATA_JWT="<your_pinata_jwt_here>"
```

If you don't have a Pinata JWT you can leave this blank but file upload proxying will fail until a valid JWT is provided.

Additionally, the backend requires a service wallet mnemonic to run. Set `SERVICE_WALLET_MNEMONIC` in `backend/.env` or export it in your shell before starting the service. The backend will exit if this mnemonic is not provided.

```bash
export SERVICE_WALLET_MNEMONIC="your 25 word mnemonic here"
```

Use a secure mnemonic for production and never commit it to source control.

Notes:
- OrbitDB stores are created under `backend/orbitdb` by default. Use the `initOrbitDB({ repo })` option to choose a different path.
- The OrbitDB wrapper aims to be Mongo-compatible for the common operations used in DecStor. It supports:
  - find(filter) with basic equality, `$in`, `$or`, and `$regex` (simple usage)
  - findOne/filter, insertOne/insertMany, updateOne/updateMany, deleteOne/deleteMany
  - Cursor chaining: `.find(...).map(...).toArray()`

Migration from MongoDB:
- This repository previously included a migration script. That script has been disabled because the backend is now OrbitDB-only.
- If you still need to migrate from an existing MongoDB instance, reintroduce a migration script that depends on `mongodb` and run it from a machine with access to the MongoDB server.

Limitations & considerations:
- OrbitDB is eventually consistent. For multi-writer setups or multiple nodes, replication delays may be visible.
- The wrapper does not implement full Mongo query language or aggregation pipelines — only the patterns used by DecStor.

If you want help running the migration or expanding query support, I can implement the next steps.
