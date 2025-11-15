# DecStor: A Decentralized File Storage & Sharing Wallet

DecStor is a web application and secure wallet for managing Algorand accounts, uploading files to IPFS, and creating verifiable "proof-of-share" records on the Algorand Testnet.

## Table of Contents
- [Key Features](#key-features)
- [Architecture & Storage Model](#architecture--storage-model)
- [Technology Stack](#technology-stack)
- [Quick Start (Local Development)](#quick-start-local-development)
- [Environment Variables](#environment-variables)
- [Smart Contract (Testnet)](#smart-contract-testnet)
- [Developer Notes](#developer-notes)
- [Contributing](#contributing)
- [Contact](#contact)

---

## Key Features

- **Multi-wallet management** (create or import 25-word mnemonics)
- **PIN-based local encryption** for wallet mnemonics
- **IPFS uploads** with optional Pinata pinning
- **Personal Vault** with file metadata managed by backend
- **Secure file sharing** recorded on Algorand as verifiable proofs
- **Inbox** for shared files

---

## Architecture & Storage Model

DecStor uses a hybrid architecture:

- Files: stored on IPFS; pinning handled by Pinata (configurable).
- Metadata & sharing records: managed off-chain by the backend (OrbitDB) and on-chain proof records via an Algorand smart contract (app-calls).
- Backend runs as a single-writer OrbitDB node (enforces write ACLs).

Current trade-offs:

- Pinata provides reliability but is a centralized dependency (free tier limitations). The roadmap documents a migration path to decentralized storage marketplaces (Filecoin/Arweave) for long-term permanence and lower cost.

---

## Technology Stack

- Frontend: `Next.js` (App Router), `TypeScript`, `Tailwind CSS`, ShadCN UI
- Backend: `Express.js`, `TypeScript`, `OrbitDB` (in-memory/demo mode)
- Smart Contract: `PyTeal` → compiled TEAL (Algorand Testnet)
- Storage: IPFS (Pinata for pinning)

---

## Quick Start (Local Development)

Run frontend and backend in two terminals.

1) Install dependencies (project root):

```bash
npm install
cd backend
npm install
cd -
```

2) Start the backend (development / OrbitDB mode):

```bash
cd backend
npm run dev
# backend listens on http://localhost:3001 by default
```

3) Start the frontend (project root):

```bash
npm run dev
# frontend runs on http://localhost:3000
```

Notes:

- The frontend development server proxies `/api` to the backend in dev.
- Check backend logs for "OrbitDB stores initialized" to confirm successful startup.

---

## Environment Variables

Create a `.env` or export the following before starting the backend.

```bash
# Required: 25-word Algorand mnemonic for the service wallet (DO NOT COMMIT)
export SERVICE_WALLET_MNEMONIC="your 25 word mnemonic here"

# Optional: Pinata JWT for pinning to IPFS
export PINATA_JWT="your_pinata_jwt_here"

# Optional: frontend -> backend base URL override
export NEXT_PUBLIC_BACKEND_URL="http://localhost:3001"
```

Security reminder: Never commit real mnemonics, keys, or JWTs to the repository. If a secret is accidentally committed, rotate it immediately and remove it from Git history.

---

## Smart Contract (Testnet)

- The project records share proofs via a PyTeal smart contract (stateless app-calls / proof-of-share pattern).
- **Testnet App ID:** `748486979` — use Algorand explorers or your preferred tooling to inspect logs and transactions for verification.
- **Algokit Testnet Viewer:** https://lora.algokit.io/testnet/application/748486979

Recommended verification steps for a share:

1. Query the Algorand indexer for the application call transaction.
2. Confirm the grouped-transaction structure (payment to service address followed by the AppCall).
3. Decode the contract log payload (the app emits a compact, machine-parsable proof).
4. Optionally fetch IPFS metadata referenced by the proof and validate hashes.

---

## Developer Notes

- `backend/` runs OrbitDB as single-writer for demo purposes; production deployments should consider persistent DB and proper access controls.
- The smart contract enforces a grouped-transaction pattern (Payment → AppCall) and includes a guard to limit bulk-share counts to avoid abuse.
- Consider adding `smartcontract/CONTRACT_WALKTHROUGH.md` and `smartcontract/examples/` scripts for easier auditing (recommended before final submission).

---

## Contributing

Contributions are welcome. Suggested first steps:

1. Open an issue describing the change or feature.
2. Create a topic branch (e.g. `feat/docs-cleanup`).
3. Run tests / linters locally where applicable and open a PR for review.

Recommended branch workflow (example):

```bash
git checkout -b feat/docs-cleanup
git add -A
git commit -m "docs: polish README"
git push -u origin feat/docs-cleanup
```

---

## Contact

If you need help running the project or want me to add the recommended verification scripts, tell me which task to implement next and I will create the files and open a PR.

---

_Last updated: November 2025_
# DecStor: A Decentralized File Storage & Sharing Wallet

DecStor is a modern web application that demonstrates a decentralized approach to file storage and sharing. It functions as a secure digital "wallet" where users can manage their Algorand accounts, upload files to the InterPlanetary File System (IPFS), and securely share them with other Algorand users.

The core principle of DecStor is to separate file ownership and access from the files themselves. File metadata and sharing permissions are managed by a custom backend, while the files are stored on the decentralized IPFS network. On-chain transactions on the Algorand Testnet are used to create an immutable, verifiable public record of each file share.

---

## Key Features

- **Multi-Wallet Management:** Create new Algorand wallets or import existing ones using a 25-word mnemonic phrase. The app can manage multiple wallets simultaneously.
- **PIN-Based Security:** Wallets are encrypted using a local, user-defined PIN. The sensitive mnemonic phrase is never stored in plaintext, ensuring user funds and assets remain secure on the device.
- **Decentralized File Uploads:** Upload files of any type directly from the user interface. Files are pinned to IPFS via the Pinata service, returning a unique Content Identifier (CID).
- **Personal File Vault:** View all uploaded files in a personal "Vault." File metadata (filename, size, CID, owner) is managed by a dedicated backend service.
- **Secure File Sharing:** Share files with any other Algorand address. The sharing action creates a verifiable proof on the Algorand blockchain via a smart contract call.
- **Shared File Inbox:** The "Inbox" displays all files that have been shared with you by other users, creating a simple and effective decentralized sharing ecosystem.
- **Modern & Responsive UI:** The application is built with Next.js, ShadCN UI, and Tailwind CSS, providing a sleek, responsive, and user-friendly experience on all devices.

---

## The Storage Model: Cost, Limits & The Path to True Decentralization

A critical aspect of any storage system is its limits and cost. Here’s how DecStor's storage model works now and how it's designed to evolve into a truly competitive, decentralized system.

### Current Model: IPFS + Centralized Pinning Service

Currently, DecStor uses a hybrid model for simplicity and reliability.

-   **How it Works:** Files are uploaded to the IPFS network. To ensure they remain permanently available, a centralized "pinning service" (specifically, **Pinata**) is used. Pinata runs highly available IPFS nodes and "pins" our users' files, acting as a reliable custodian for the data on the network.
-   **Limits & Cost:** The storage limit is defined by the plan associated with the Pinata account whose API key is used in this application. Free tiers typically offer around 1GB of storage. To store more, the owner of the Pinata account must upgrade to a paid plan.
-   **Payment:** Payments are handled "off-chain" on Pinata's website using traditional methods like a credit card. **This is a centralized dependency we aim to remove.**

### The Vision: Decentralized Storage Marketplace (Filecoin/Arweave)

To become a truly robust, scalable, and low-cost system, DecStor is designed to integrate directly with a decentralized storage marketplace like **Filecoin**.

-   **How it Works:** Instead of relying on a single company like Pinata, the app would allow users to pay for storage directly on an open, global marketplace.
    1.  A user's file (already encrypted client-side) is offered to the Filecoin network.
    2.  The user makes a "deal," offering a small amount of cryptocurrency for multiple storage providers (miners) around the world to store their data for a set duration (e.g., one year).
    3.  These providers must cryptographically prove they are continuously and correctly storing the data to receive their payment. This creates a resilient, self-healing network for the user's files.
-   **Limits & Cost:**
    -   **Limitless Storage:** There is no theoretical limit. You can store petabytes of data if you are willing to pay the storage providers for it.
    -   **Drastically Lower Cost:** Because of the intense global competition between storage providers, the cost of storage on these networks is often orders of magnitude cheaper than on centralized services like AWS S3 or Google Drive.
-   **Payment with Algorand:** The user experience would remain seamless. A user would keep ALGO in their DecStor wallet. When they need to pay for storage, the application could use an integrated decentralized exchange to instantly swap the required amount of ALGO for Filecoin's native token (FIL) to complete the storage deal. The user never has to leave the app or manually manage different cryptocurrencies.

This evolutionary path allows DecStor to compete directly with centralized storage systems by offering a more secure, resilient, and cost-effective solution, all while keeping the user in complete control of their data and funds.

---

