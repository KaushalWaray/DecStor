
import algosdk, {Algodv2, generateAccount as generateAlgodAccount, secretKeyToMnemonic, mnemonicToSecretKey, waitForConfirmation, isValidAddress, makeApplicationNoOpTxnFromObject, makeApplicationOptInTxn, assignGroupID, OnApplicationComplete} from 'algosdk';
import { ALGOD_SERVER, ALGOD_TOKEN, ALGOD_PORT, ALGO_NETWORK_FEE, MAILBOX_APP_ID } from './constants';
import type { AlgorandAccount, FileMetadata } from '@/types';
import { getFilesByOwner, shareFileWithUser as shareFileWithUserApi } from './api';

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


// This function ensures the sender has opted into the contract to be able to send shares.
// It is a required step before they can call the smart contract.
const ensureSenderOptedIn = async (account: AlgorandAccount) => {
    const accountInfo = await algodClient.accountInformation(account.addr).do();
    const isOptedIn = accountInfo['apps-local-state']?.some(
        (app: any) => app.id === MAILBOX_APP_ID
    );

    if (!isOptedIn) {
        console.log(`[Algorand] Account ${account.addr} is not opted in. Opting in now...`);
        const params = await algodClient.getTransactionParams().do();
        const optInTxn = makeApplicationOptInTxn(
            account.addr,
            params,
            MAILBOX_APP_ID
        );
        const signedTxn = optInTxn.signTxn(account.sk);
        const txId = optInTxn.txID().toString();
        await algodClient.sendRawTransaction(signedTxn).do();
        await waitForConfirmation(algodClient, txId, 4);
        console.log(`[Algorand] Account ${account.addr} successfully opted in to send.`);
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

  // 1. Ensure the SENDER has opted into the contract.
  // This is required for them to be able to call the contract.
  await ensureSenderOptedIn(sender);
  
  // 2. Send the on-chain transaction to create a verifiable, immutable proof of the share.
  console.log(`[Algorand] Sending on-chain proof for sharing ${cid} to ${recipientAddress}`);
  
  const params = await algodClient.getTransactionParams().do();
  const appArgs = [
      new Uint8Array(Buffer.from("share")),
      new Uint8Array(Buffer.from(cid))
  ];
  // The recipient address is passed in the "accounts" array for the smart contract to read.
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
  
  // Send the transaction and wait for confirmation
  const result = await algodClient.sendRawTransaction(signedTxn).do();
  await waitForConfirmation(algodClient, txId, 4);

  console.log(`[Algorand] On-chain proof transaction successful with ID: ${txId}`);

  // 3. After on-chain success, update our backend database to record the share.
  // This allows the recipient's inbox to work immediately.
  await shareFileWithUserApi(cid, recipientAddress);


  return {
    message: "File shared and recorded on-chain successfully.",
    txId: txId,
    ...result
  };
};

// This function is no longer needed, as the inbox is now powered by the API.
// export const readInbox = async (address: string): Promise<FileMetadata[]> => {
//     // ... old implementation
// };
