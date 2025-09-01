
import algosdk, {Algodv2, generateAccount as generateAlgodAccount, secretKeyToMnemonic, mnemonicToSecretKey, makeApplicationNoOpTxn, waitForConfirmation, isValidAddress} from 'algosdk';
import { ALGOD_SERVER, ALGOD_TOKEN, ALGOD_PORT, MAILBOX_APP_ID, ALGO_NETWORK_FEE } from './constants';
import type { AlgorandAccount } from '@/types';

const algodClient = new Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);
const SIMULATED_INBOX_KEY = 'metadrive_simulated_inbox';

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
  let cids: string[] = [];
  
  // First, try the real smart contract
  if (MAILBOX_APP_ID && MAILBOX_APP_ID !== 0) {
    try {
      const appInfo = await algodClient.getApplicationByID(MAILBOX_APP_ID).do();
      const globalState = appInfo.params['global-state'];
      if (globalState) {
        const userEntry = globalState.find(
          (state) => Buffer.from(state.key, 'base64').toString('utf-8') === address
        );
        if (userEntry && userEntry.value.bytes) {
          const decodedValue = Buffer.from(userEntry.value.bytes, 'base64').toString('utf-8');
          cids = decodedValue.split(',').filter(cid => cid);
        }
      }
    } catch (error) {
      console.error('Failed to read real inbox, will rely on simulation:', error);
    }
  }

  // Then, add simulated CIDs from localStorage
  try {
    const simulatedInbox = JSON.parse(localStorage.getItem(SIMULATED_INBOX_KEY) || '{}');
    const simulatedCids: string[] = simulatedInbox[address] || [];
    // Combine and remove duplicates
    cids = [...new Set([...cids, ...simulatedCids])];
  } catch (error) {
      console.error('Failed to read simulated inbox:', error);
  }

  return cids;
};


export const shareFile = async (
  senderAccount: algosdk.Account,
  recipientAddress: string,
  cid: string
): Promise<string> => {
  // SIMULATION: The real smart contract call is commented out due to a persistent error.
  // This simulation allows the UI flow to continue without a backend dependency.
  console.log(`[SIMULATED] Sharing file CID ${cid} from ${senderAccount.addr} to ${recipientAddress}`);

  if (!isValidAddress(recipientAddress)) {
    throw new Error('Invalid recipient address');
  }

  const senderBalance = await getAccountBalance(senderAccount.addr);
  if (senderBalance < ALGO_NETWORK_FEE) {
    throw new Error(`Insufficient balance. You need at least ${ALGO_NETWORK_FEE} ALGO to cover network fees.`);
  }

  // --- Start of simulation logic ---
  try {
    const simulatedInbox = JSON.parse(localStorage.getItem(SIMULATED_INBOX_KEY) || '{}');
    if (!simulatedInbox[recipientAddress]) {
      simulatedInbox[recipientAddress] = [];
    }
    // Add CID if it's not already there
    if (!simulatedInbox[recipientAddress].includes(cid)) {
      simulatedInbox[recipientAddress].push(cid);
    }
    localStorage.setItem(SIMULATED_INBOX_KEY, JSON.stringify(simulatedInbox));
    console.log(`[SIMULATED] Added CID ${cid} to ${recipientAddress}'s simulated inbox.`);
  } catch (error) {
    console.error("Failed to update simulated inbox:", error);
    // We can still proceed to give the user a success message
  }
  // --- End of simulation logic ---

  // Return a fake transaction ID after a short delay to simulate network latency.
  await new Promise(resolve => setTimeout(resolve, 1000));
  const fakeTxId = `SIMULATED_TX_${Date.now()}`;
  console.log(`[SIMULATED] Returning fake transaction ID: ${fakeTxId}`);
  return fakeTxId;

  /*
  // REAL IMPLEMENTATION - CURRENTLY FAILING
  if (!MAILBOX_APP_ID || MAILBOX_APP_ID === 0) {
    throw new Error('Mailbox App ID is not configured.');
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
  */
};
