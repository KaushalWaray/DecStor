
import algosdk, {Algodv2, generateAccount as generateAlgodAccount, secretKeyToMnemonic, mnemonicToSecretKey, makeApplicationNoOpTxn, waitForConfirmation, isValidAddress, decodeAddress} from 'algosdk';
import { ALGOD_SERVER, ALGOD_TOKEN, ALGOD_PORT, MAILBOX_APP_ID } from './constants';
import type { AlgorandAccount } from '@/types';

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
    // A simple way to check validity is to try and convert it.
    // The SDK will throw an error if it's invalid.
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
  if (!MAILBOX_APP_ID || MAILBOX_APP_ID === 0) return [];
  try {
    const appInfo = await algodClient.getApplicationByID(MAILBOX_APP_ID).do();
    const globalState = appInfo.params['global-state'];
    if (!globalState) return [];

    const userEntry = globalState.find(
      (state) => atob(state.key) === address
    );

    if (userEntry && userEntry.value.bytes) {
      const decodedValue = atob(userEntry.value.bytes);
      // CIDs are stored as a comma-separated string
      return decodedValue.split(',').filter(cid => cid);
    }
    return [];
  } catch (error) {
    console.error('Failed to read inbox:', error);
    return [];
  }
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

  const params = await algodClient.getTransactionParams().do();
  
  // The first argument is the method selector.
  // The second is the recipient's address.
  // The third is the file's CID.
  const appArgs = [
    new TextEncoder().encode('post'),
    decodeAddress(recipientAddress).publicKey,
    new TextEncoder().encode(cid),
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
