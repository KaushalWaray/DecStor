
import algosdk, {Algodv2, generateAccount as generateAlgodAccount, secretKeyToMnemonic, mnemonicToSecretKey, makeApplicationNoOpTxn, waitForConfirmation, isValidAddress} from 'algosdk';
import { ALGOD_SERVER, ALGOD_TOKEN, ALGOD_PORT, MAILBOX_APP_ID, ALGO_NETWORK_FEE } from './constants';
import type { AlgorandAccount } from '@/types';
import { getFilesByOwner } from './api';

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
    if (!MAILBOX_APP_ID || MAILBOX_APP_ID === 0) {
        console.warn('Mailbox App ID is not configured. Cannot read inbox.');
        return [];
    }
    try {
        const ownerFiles = await getFilesByOwner(address);
        // In a real app, you'd have a dedicated inbox table.
        // For now, we'll just return all files not owned by the current user.
        return ownerFiles.filter(f => f.owner !== address).map(f => f.cid);
    } catch (error) {
        console.error('Failed to read inbox from API:', error);
    }
    return [];
};


export const shareFile = async (
  senderAccount: algosdk.Account,
  recipientAddress: string,
  cid: string
): Promise<string> => {

  if (!MAILBOX_APP_ID || MAILBOX_APP_ID === 0) {
    throw new Error('Mailbox App ID is not configured.');
  }

  if (!isValidAddress(recipientAddress)) {
    throw new Error('Invalid recipient address');
  }

  const senderBalance = await getAccountBalance(senderAccount.addr);
  if (senderBalance < ALGO_NETWORK_FEE) {
    throw new Error(`Insufficient balance. You need at least ${ALGO_NETWORK_FEE} ALGO to cover network fees.`);
  }
  
  const params = await algodClient.getTransactionParams().do();
  
  const appArgs = [
    new TextEncoder().encode("post_cid"),
    new TextEncoder().encode(cid)
  ];
  
  const accounts = [recipientAddress];

  const txn = makeApplicationNoOpTxn(
    senderAccount.addr,
    params,
    MAILBOX_APP_ID,
    appArgs,
    accounts
  );

  const signedTxn = txn.signTxn(senderAccount.sk);
  const { txId } = await algodClient.sendRawTransaction(signedTxn).do();
  await waitForConfirmation(algodClient, txId, 4);
  return txId;
};
