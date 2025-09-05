
import type { Account } from 'algosdk';

export type WalletState = 'loading' | 'no_wallet' | 'creating' | 'importing' | 'locked' | 'unlocked';

export type AlgorandAccount = Account & {
  mnemonic: string;
};

export interface FileMetadata {
  _id: string;
  filename: string;
  cid: string;
  size: number;
  fileType: string;
  owner: string;
  createdAt: string;
  path: string; // e.g., "/", "/documents/", "/photos/vacation/"
}

export interface Folder {
    _id: string;
    name: string;
    owner: string;
    path: string; // e.g., "/", "/documents/"
    createdAt: string;
    isLocked?: boolean;
}

export interface Share {
  cid: string;
  senderAddress: string;
  recipientAddress: string;
  createdAt: string;
}

export interface DecodedInbox {
  [address: string]: string[];
}

export interface WalletEntry {
  address: string;
  encryptedMnemonic: string;
}

export interface StorageInfo {
    storageUsed: number;
    storageLimit: number;
}

export interface FilesAndStorageInfo {
    files: FileMetadata[];
    folders: Folder[];
    storageInfo: StorageInfo;
    sharedFiles: FileMetadata[];
}

export interface Activity {
  _id: string;
  type: 'UPLOAD' | 'SHARE' | 'DELETE' | 'SEND_ALGO' | 'RECEIVE_ALGO';
  owner: string;
  timestamp: string;
  details: {
    filename?: string;
    folderName?: string;
    cid?: string;
    recipient?: string;
    itemCount?: number;
    amount?: number;
    sender?: string;
    senderAddress?: string; // Added for received shares
  };
  isRead: boolean;
}

export interface ActivityLogInfo {
    activities: Activity[];
}
