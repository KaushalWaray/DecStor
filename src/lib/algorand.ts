
import algosdk, {Algodv2, generateAccount as generateAlgodAccount, secretKeyToMnemonic, mnemonicToSecretKey, waitForConfirmation, isValidAddress} from 'algosdk';
import { ALGOD_SERVER, ALGOD_TOKEN, ALGOD_PORT, ALGO_NETWORK_FEE } from './constants';
import type { AlgorandAccount } from '@/types';
import { getFilesByOwner, shareFileWithUser } from './api';

const algodClient = new Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);

export const generateAccount = (): AlgorandAccount => {
  const account = generateAlgodAccount();
  const mnemonic = secretKeyToMnemonic(account.sk);
  return { ...account, mnemonic };
};

export const mnemonicToAccount = (mnemonic: string): AlgorandAccount => {
  const account = mnemonicToSecretKey(mnemonic);
  return { ...account, mnemonic };
};

export const isValidMnemonic = (mnemonic: string): boolean => {
  try {
    mnemonicToSecretKey(mnemonic);
    return true;
  } catch (e) {
    return false;
  }
};

export const getAccountBalance = async (address: string): Promise<number> => {
  try {
    const accountInfo = await algodClient.accountInformation(address).do();
    return accountInfo.amount / 1_000_000; // Convert microAlgos to Algos
  } catch (error) {
    console.error('Failed to get account balance:', error);
    return 0;
  }
};


export const readInbox = async (address: string): Promise<string[]> => {
    try {
        // This will eventually be replaced by a direct API call to get shared files.
        const ownerFiles = await getFilesByOwner(address);
        // In our new model, the backend determines what's in the inbox.
        // For now, we simulate this by filtering files not owned by the user.
        // This logic will be updated once the share endpoint is fully integrated.
        return ownerFiles.filter(f => f.owner !== address).map(f => f.cid);
    } catch (error) {
        console.error('Failed to read inbox from API:', error);
    }
    return [];
};


export const shareFile = async (
  senderAddress: string,
  recipientAddress: string,
  cid: string
): Promise<any> => {
  if (!isValidAddress(recipientAddress)) {
    throw new Error('Invalid recipient address');
  }
  
  // No more on-chain transaction. Just a simple API call.
  console.log(`[Simulating Share] From: ${senderAddress}, To: ${recipientAddress}, CID: ${cid}`);
  
  // For now, we'll just log and return a simulated success message.
  // In a real implementation, this would call the backend API.
  await shareFileWithUser(cid, recipientAddress);
  
  return {
    message: "File shared successfully via backend.",
    txId: `SIMULATED_${Date.now()}`
  };
};
