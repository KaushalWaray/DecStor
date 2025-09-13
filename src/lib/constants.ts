
export const ALGOD_SERVER = "https://testnet-api.algonode.cloud";
export const ALGOD_TOKEN = ""; // Empty token for public node
export const ALGOD_PORT = 443;
export const MAILBOX_APP_ID = 745160970; // IMPORTANT: This is your deployed smart contract App ID

// Use the deployed backend URL in production, but the local proxy for development
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '/api';

export const ALGO_NETWORK_FEE = 0.001;
export const IPFS_GATEWAY_URL = "https://olive-fantastic-louse-905.mypinata.cloud/ipfs";

// --- Storage Payment Simulation Constants ---

// Storage limits in bytes
export const FREE_TIER_LIMIT = 1 * 1024 * 1024; // 1 MB
export const PRO_TIER_LIMIT = 100 * 1024 * 1024; // 100 MB

// Cost in ALGOs to upgrade
export const UPGRADE_COST_ALGOS = 0.1;

  