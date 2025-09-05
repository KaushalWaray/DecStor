export const PINATA_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJmNmZlY2VjYy05NWVmLTRjMzEtOGI5OS05ZmEwMGE1ZDQ2OGYiLCJlbWFpbCI6ImZyZWFreWZydXR6QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiJjNzRhYWQyNTQ2YjI2ZDVkY2I3NCIsInNjb3BlZEtleVNlY3JldCI6ImE5Yzg0ODc3ZDc1ZDVjZjYzZmFiODZiZDAxZjE2YzM5MTU1Njk0NjQ5YTAwM2VjOWQwOGI5ODE1NTc1OTI0NTQiLCJleHAiOjE3ODU4NTgzMzl9.JOUYmPrXuDjHW-j-ivOw03vGtZ1QY_XP_aYlQF1Ng2w";
export const ALGOD_SERVER = "https://testnet-api.algonode.cloud";
export const ALGOD_TOKEN = ""; // Empty token for public node
export const ALGOD_PORT = 443;
export const MAILBOX_APP_ID = 745160970; // IMPORTANT: This is your deployed smart contract App ID
export const BACKEND_URL = "/api";
export const ALGO_NETWORK_FEE = 0.001;
export const IPFS_GATEWAY_URL = "https://gateway.pinata.cloud/ipfs";

// --- Storage Payment Simulation Constants ---

// A placeholder wallet address to receive "payments" for storage upgrades.
// In a real scenario, this would be a secure, company-owned wallet.
export const STORAGE_SERVICE_WALLET_ADDRESS = "GD64YIY3TWGDMCNPP553DZPNE67M3Q55V2ETR2RO3OUZH6YZZK55CNHNTI";

// Storage limits in bytes
export const FREE_TIER_LIMIT = 1 * 1024 * 1024; // 1 MB
export const PRO_TIER_LIMIT = 100 * 1024 * 1024; // 100 MB

// Cost in ALGOs to upgrade
export const UPGRADE_COST_ALGOS = 0.1;
