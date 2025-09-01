
import algosdk, {Algodv2, generateAccount as generateAlgodAccount, secretKeyToMnemonic, mnemonicToSecretKey, waitForConfirmation, isValidAddress, makeApplicationNoOpTxnFromObject, assignGroupID, OnApplicationComplete} from 'algosdk';
import { ALGOD_SERVER, ALGOD_TOKEN, ALGOD_PORT, ALGO_NETWORK_FEE, MAILBOX_APP_ID } from './constants';
import type { AlgorandAccount, FileMetadata } from '@/types';
import { getFilesByCids, shareFileWithUser as shareFileWithUserApi } from './api';

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

export const ensureOptedIn = async (account: AlgorandAccount): Promise<void> => {
  try {
    const accountInfo = await algodClient.accountInformation(account.addr).do();
    const isOptedIn = accountInfo['apps-local-state'].some(
      (app: any) => app.id === MAILBOX_APP_ID
    );

    if (!isOptedIn) {
      console.log(`[Algorand] Account ${account.addr} is not opted in. Opting in now...`);
      const params = await algodClient.getTransactionParams().do();
      const optInTxn = algosdk.makeApplicationOptInTxn(
        account.addr,
        params,
        MAILBOX_APP_ID
      );
      const signedTxn = optInTxn.signTxn(account.sk);
      const txId = optInTxn.txID().toString();
      await algodClient.sendRawTransaction(signedTxn).do();
      await waitForConfirmation(algodClient, txId, 4);
      console.log(`[Algorand] Account ${account.addr} successfully opted in.`);
    }
  } catch (error) {
    console.error(`[Algorand] Failed to check/perform opt-in for ${account.addr}:`, error);
    throw new Error('Failed to ensure wallet is opted into the smart contract.');
  }
};


export const readInbox = async (address: string): Promise<FileMetadata[]> => {
    try {
        const accountInfo = await algodClient.accountInformation(address).do();
        const appLocalState = accountInfo['apps-local-state'].find(
            (app: any) => app.id === MAILBOX_APP_ID
        );

        if (!appLocalState || !appLocalState['key-value']) {
            return [];
        }
        
        const cids = appLocalState['key-value'].map((kv: any) => {
            // Keys (CIDs) are base64 encoded by the node, so we need to decode them.
            return Buffer.from(kv.key, 'base64').toString();
        });

        if (cids.length === 0) {
            return [];
        }
        
        // This is inefficient. In a real app, you'd have a dedicated backend endpoint for this.
        // For this demo, we fetch all files shared with the user and then filter.
        const allSharedFiles = await getFilesByCids(cids);
        return allSharedFiles;

    } catch (error) {
        console.error('Failed to read on-chain inbox:', error);
        return [];
    }
};


export const shareFile = async (
  sender: AlgorandAccount,
  recipientAddress: string,
  cid: string
): Promise<any> => {
  if (!isValidAddress(recipientAddress)) {
    throw new Error('Invalid recipient address');
  }

  try {
    const recipientInfo = await algodClient.accountInformation(recipientAddress).do();
    const isOptedIn = recipientInfo['apps-local-state']?.some(
      (app: any) => app.id === MAILBOX_APP_ID
    );
    if (!isOptedIn) {
      throw new Error(`Recipient has not yet activated their inbox. They must log into their wallet and visit the "Inbox" tab at least once before they can receive files.`);
    }
  } catch(e) {
      console.error(e);
      throw new Error(`Could not verify recipient's account on the blockchain. They may need to receive ALGO to activate their account and then visit their "Inbox" to initialize it.`);
  }

  console.log(`[Algorand] Sharing file ${cid} from ${sender.addr} to ${recipientAddress}`);
  
  // 1. Save metadata to our backend so the recipient can find it after getting the CID
  await shareFileWithUserApi(cid, recipientAddress);

  // 2. Call the smart contract to store the CID in the recipient's local state
  const params = await algodClient.getTransactionParams().do();
  const appArgs = [
      new Uint8Array(Buffer.from("share")),
      new Uint8Array(Buffer.from(cid))
  ];
  const accounts = [recipientAddress];

  const appCallTxn = makeApplicationNoOpTxnFromObject({
      from: sender.addr,
      suggestedParams: params,
      appIndex: MAILBOX_APP_ID,
      appArgs,
      accounts,
  });

  const signedTxn = appCallTxn.signTxn(sender.sk);
  const txId = appCallTxn.txID().toString();
  
  await algodClient.sendRawTransaction(signedTxn).do();
  const result = await waitForConfirmation(algodClient, txId, 4);

  console.log(`[Algorand] Share transaction successful with ID: ${txId}`);
  return {
    message: "File shared successfully on-chain.",
    txId: txId,
    ...result
  };
};

// A helper function to truncate addresses for display
function truncateAddress(address: string) {
    if (!address) return "";
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}
