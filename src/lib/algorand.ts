
import algosdk, {Algodv2, generateAccount as generateAlgodAccount, secretKeyToMnemonic, mnemonicToSecretKey, makeApplicationNoOpTxn, waitForConfirmation, isValidAddress} from 'algosdk';
import { ALGOD_SERVER, ALGOD_TOKEN, ALGOD_PORT, MAILBOX_APP_ID, ALGO_NETWORK_FEE } from './constants';
import type { AlgorandAccount } from '@/types';

const algodClient = new Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);
const RECIPIENT_PREFIX = "rcpt_"; // Prefix used in the smart contract

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
    // The most reliable way to check a mnemonic is to try to convert it.
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
      const appInfo = await algodClient.getApplicationByID(MAILBOX_APP_ID).do();
      const globalState = appInfo.params['global-state'];
      
      if (globalState) {
          const mailboxKey = RECIPIENT_PREFIX + address;
          // The key in global state is base64 encoded. We need to encode our key to find it.
          const encodedMailboxKey = Buffer.from(mailboxKey).toString('base64');
          
          const userEntry = globalState.find(
              (state) => state.key === encodedMailboxKey
          );
          
          if (userEntry && userEntry.value.bytes) {
              const decodedValue = Buffer.from(userEntry.value.bytes, 'base64').toString('utf-8');
              // Return an array of CIDs by splitting the string
              return decodedValue.split(',').filter(cid => cid);
          }
      }
  } catch (error) {
      console.error('Failed to read inbox from smart contract:', error);
  }

  // Return empty array if no entry is found or an error occurs
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
    new TextEncoder().encode("post"),
    new TextEncoder().encode(recipientAddress),
    new TextEncoder().encode(cid)
  ];

  const txn = makeApplicationNoOpTxn(
    senderAccount.addr,
    params,
    MAILBOX_APP_ID,
    appArgs,
  );

  const signedTxn = txn.signTxn(senderAccount.sk);
  const { txId } = await algodClient.sendRawTransaction(signedTxn).do();
  await waitForConfirmation(algodClient, txId, 4);
  return txId;
};
