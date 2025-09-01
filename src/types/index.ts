
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
}

export interface Share {
  cid: string;
  ownerAddress: string;
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
