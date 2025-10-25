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

The Next.js frontend is configured to proxy requests from `/api` to this backend service, so both components can communicate seamlessly.

### 3. (Optional) Deploy the Smart Contract

The application is pre-configured with a deployed smart contract ID. If you wish to deploy your own version:

1.  **Update Mnemonic:** Add your 25-word Algorand Testnet mnemonic to `smartcontract/deploy_contract.py`.
2.  **Run Deploy Script:**
    ```bash
    npm run contract:deploy
    ```
3.  **Update App ID:** Copy the new Application ID from the script's output and paste it into the `MAILBOX_APP_ID` constant in `src/lib/constants.ts`.
