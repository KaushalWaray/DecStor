# MetaDrive: A Decentralized File Storage & Sharing Wallet

MetaDrive is a modern web application that demonstrates a decentralized approach to file storage and sharing. It functions as a secure digital "wallet" where users can manage their Algorand accounts, upload files to the InterPlanetary File System (IPFS), and securely share them with other Algorand users.

The core principle of MetaDrive is to separate file ownership and access from the files themselves. File metadata and sharing permissions are managed by a custom backend, while the files are stored on the decentralized IPFS network. On-chain transactions on the Algorand Testnet are used to create an immutable, verifiable public record of each file share.

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

## Technology Stack

MetaDrive is built with a modern, full-stack TypeScript architecture.

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

To run MetaDrive, you need to start both the frontend and backend services in separate terminals.

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
