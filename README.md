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

## Technology Stack

DecStor is built with a modern, full-stack TypeScript architecture.

### Frontend:

- **Framework:** [Next.js](https://nextjs.org/) (with App Router)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **UI Components:** [ShadCN UI](https://ui.shadcn.com/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Blockchain Interaction:** [algosdk-js](https://github.com/algorand/js-algorand-sdk)
- **Decentralized Storage:** [Pinata](https://www.pinata.cloud/) for IPFS pinning.

### Backend:

- **Framework:** [Express.js](https://expressjs.com/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Database:** In-memory data store (for demonstration purposes).
- **API Style:** REST

### Smart Contract:

- **Language:** [PyTeal](https://pyteal.algorand.org/) (compiles to TEAL)
- **Blockchain:** [Algorand Testnet](https://testnet.algorand.network/)
- **Functionality:** Provides an on-chain, immutable "proof-of-share" record. It is stateless, meaning users do not need to opt-in to the contract.

---

## How to Run the Application

To run DecStor, you need to start both the frontend and backend services in separate terminals.

### 1. Run the Frontend Server

In your first terminal, start the Next.js development server from the project's root directory:

```bash
npm run dev
```

This will start the frontend on `http://localhost:3000` (or another available port).

### 2. Run the Backend Server

In a second, separate terminal, start the Express.js backend server from the project's root directory:

```bash
npm run backend:dev
```

## Running the backend (OrbitDB-only)

The backend now runs in OrbitDB-only mode by default (no MongoDB support). To start the backend in development mode:

```bash
cd backend
npm run dev
```

Notes on usage and logs
- Check backend startup and OrbitDB init using the backend logs (look for "OrbitDB stores initialized" and the listening address `http://localhost:3001`).
- Verify the frontend at `http://localhost:3000` (Next dev will proxy `/api` to the backend in development).

Before starting the backend, export your Pinata JWT (used when the backend proxies file uploads to Pinata):

```bash
export PINATA_JWT="<your_pinata_jwt_here>"
```

If you don't have a Pinata JWT you can leave this blank but file upload proxying will fail until a valid JWT is provided.

Also export the service wallet mnemonic the backend requires. The backend will exit if `SERVICE_WALLET_MNEMONIC` is not set — create a .env file in `backend/` or export it in your shell before starting.

```bash
# 25-word Algorand mnemonic (example only — DO NOT use this in production)
export SERVICE_WALLET_MNEMONIC="your 25 word mnemonic here"
```

If you don't have a mnemonic yet, generate one using your Algorand tooling or create a wallet in the app UI (the backend will prompt and exit if not set).

Security & privacy reminders (short):
- The backend creates the OrbitDB docstores as single-writer stores (write access is the backend identity). That means the backend is the only component that writes to OrbitDB; clients call API endpoints and the backend enforces access control.
- OrbitDB/docstores are readable by any peer that can access/replicate the store. If you need file privacy, do not rely on OrbitDB read ACLs — instead encrypt file contents before uploading or use authenticated streaming and a private pinning service.

Can I remove MongoDB entirely?
- Yes — MongoDB support has been removed from the backend. The `backend/package.json` no longer depends on `mongodb` and the runtime path now uses OrbitDB only. If you need to migrate existing MongoDB data, create a one-off migration script on a machine that can reach your MongoDB instance and run it to copy documents into OrbitDB.

If you'd like, I can add a short `scripts` section or a helper shell script to start/stop the backend and frontend and to collect the logs under `scripts/` for easier development.


This command will compile the backend's TypeScript code and start the server. You should see a confirmation message:

```
✅ Backend service listening at http://localhost:3001
```

## Quick start (step-by-step)

Follow these steps to get the project running locally on Windows (PowerShell). These instructions install dependencies, set the required environment variables, and start both frontend and backend.

1. Install root (frontend) dependencies

```powershell
# From project root
npm install
```

2. Install backend dependencies

```powershell
cd backend
npm install
```

3. Set required environment variables

You must provide a service wallet mnemonic for backend operations and (optionally) a Pinata JWT if you want server-side pinning. Examples below show PowerShell commands — replace placeholder values with your real secrets.

```powershell
# In PowerShell (temporary for current session)
$env:SERVICE_WALLET_MNEMONIC = "your 25 word algorand mnemonic here"
$env:PINATA_JWT = "your_pinata_jwt_here"

# Optionally, point the frontend to a backend URL in production
$env:NEXT_PUBLIC_BACKEND_URL = "http://localhost:3001"
```

You can also create a `.env` file in the `backend/` folder with these values (the backend uses `dotenv`):

```
SERVICE_WALLET_MNEMONIC="your 25 word algorand mnemonic here"
PINATA_JWT="your_pinata_jwt_here"
```

4. Start the backend

```powershell
cd backend
npm run dev
```

5. Start the frontend (from project root)

```powershell
cd ..\
npm run dev
```

Open `http://localhost:3000` in your browser. In development the Next.js app proxies `/api` to the backend at `http://127.0.0.1:3001`.

---

## What is decentralization? (simple language)

Decentralization means data or services are not controlled by a single company or server. Instead, many independent nodes or computers can store or serve data. That makes systems harder to censor, removes a single point of failure, and gives users more control over their data.

## The problem this project solves

Centralized cloud storage ties your files to one company. If that provider goes down, loses data, or changes rules, you can lose access or control. DecStor solves this by:

- Storing file content on IPFS (a peer-to-peer content-addressed network).
- Keeping only metadata and access controls in a backend that can be audited.
- Recording sharing actions on Algorand so there is an immutable proof that a file was shared.

In short: it reduces trust in a single provider, gives users cryptographic proof of shares, and enables more resilient storage.

## What this project is (short)

DecStor is a web app (Next.js frontend + Express backend) that lets users upload files to IPFS (pinning via Pinata), manage them in a vault, share them securely with Algorand transactions, and keep metadata in OrbitDB. Wallet mnemonics are encrypted client-side using a PIN.

## Features (detailed)

- Wallet management
    - Create new Algorand accounts or import existing ones using a 25-word mnemonic.
    - Mnemonics are encrypted in the browser using PBKDF2 + AES-GCM and a user PIN.

- File uploads and pinning
    - Files are uploaded from the browser and proxied through the backend to Pinata (IPFS pinning).
    - File metadata (filename, CID, size, owner, path) is stored in OrbitDB docstores.

- File download and preview
    - Files are fetched from IPFS via a backend proxy (to avoid CORS and custom-gateway restrictions), decrypted locally with the user's PIN, and saved to disk.
    - Audio and video files can be previewed in-browser after decryption.

- Secure sharing and proofs
    - Sharing creates an on-chain proof of share by calling a mailbox smart contract on Algorand (app call).
    - Single-file and bulk sharing flows (bulk uses Merkle commits and a watcher that posts commits to the backend).

- Storage tiers and payments
    - Users can pay ALGO to a service wallet to upgrade storage tiers (backend confirms payment and upgrades the user's tier).

- Activity, contacts, and 2FA
    - Activity / notification logs track uploads, shares, and payments.
    - Simple contacts management and optional TOTP-based 2FA.

## How it works — functionality and flow (simple)

1. Wallet creation/import
     - User creates or imports an Algorand wallet. The app encrypts the wallet mnemonic with the user's PIN and stores it in localStorage.

2. Uploading a file
     - User chooses a file and uploads it via the frontend.
     - Frontend sends the file to the backend (`/api/files/upload`). The backend proxies this to Pinata to pin the file on IPFS and returns the CID.
     - Frontend or backend saves file metadata (CID, owner, path) in OrbitDB through the backend API (`/api/files/metadata`).

3. Downloading / previewing
     - When the user downloads or previews a file, the frontend calls `/api/files/proxy/:cid` on the backend.
     - The backend fetches the CID from public gateways (server-side), returns the bytes to the browser, and the frontend decrypts the blob with the user's PIN and saves or previews it.

4. Sharing a file
     - To share, the frontend makes an Algorand app call transaction (grouped payment + app call) using the user's unlocked key.
     - The transaction creates an on-chain proof that the file identified by CID was shared with a recipient address.
     - The frontend then notifies the backend to record the share in the `shares` collection of OrbitDB. Activities are created for both sender and recipient.

5. Bulk sharing and watcher
     - For bulk operations, the app creates a Merkle root of many CIDs and submits it on-chain.
     - A separate watcher process scans Algorand for bulk events and posts commits to the backend (`/api/bulk/commit`) so shares can be recorded.

6. Storage upgrade
     - A user pays ALGO to the service wallet to upgrade storage; after the payment is confirmed (backend endpoint `/api/payment/confirm`) the user's storage tier is upgraded.

## Notes and best practices

- Pinning: IPFS content availability depends on nodes that pin the CID. Use Pinata or another pinning service to keep your content available.
- Security: Never commit real mnemonics or JWTs to git. Use environment variables or secure secret storage.
- Production: In production, set `NEXT_PUBLIC_BACKEND_URL` to your backend URL and ensure the backend `SERVICE_WALLET_MNEMONIC` and `PINATA_JWT` are set on the server.

---

If you'd like, I can also add a short troubleshooting section (common errors and fixes) or add the example PowerShell scripts to set env variables permanently on Windows.

The Next.js frontend is configured to proxy requests from `/api` to this backend service, so both components can communicate seamlessly.

### 3. (Optional) Deploy the Smart Contract

The application is pre-configured with a deployed smart contract ID. If you wish to deploy your own version:

1.  **Update Mnemonic:** Add your 25-word Algorand Testnet mnemonic to `smartcontract/deploy_contract.py`.
2.  **Run Deploy Script:**
    ```bash
    npm run contract:deploy
    ```
3.  **Update App ID:** Copy the new Application ID from the script's output and paste it into the `MAILBOX_APP_ID` constant in `src/lib/constants.ts`.
