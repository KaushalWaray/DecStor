
import algosdk, {Algodv2, generateAccount as generateAlgodAccount, secretKeyToMnemonic, mnemonicToSecretKey, waitForConfirmation, isValidAddress, makeApplicationNoOpTxnFromObject, makePaymentTxnWithSuggestedParamsFromObject, OnApplicationComplete} from 'algosdk';
import { ALGOD_SERVER, ALGOD_TOKEN, ALGOD_PORT, MAILBOX_APP_ID, UPGRADE_COST_ALGOS } from './constants';
import type { AlgorandAccount } from '@/types';
import { recordShareInDb } from './api';

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

export const shareFile = async (
  sender: AlgorandAccount,
  recipientAddress: string,
  cid: string
): Promise<any> => {
  if (!isValidAddress(recipientAddress)) {
    throw new Error('Invalid recipient address');
  }
  
  console.log(`[Algorand] Sending on-chain proof for sharing ${cid} with ${recipientAddress}`);
  
  const params = await algodClient.getTransactionParams().do();
  const appArgs = [
      new Uint8Array(Buffer.from("share")),
      new Uint8Array(Buffer.from(cid))
  ];

  const appCallTxn = makeApplicationNoOpTxnFromObject({
      from: sender.addr,
      suggestedParams: params,
      appIndex: MAILBOX_APP_ID,
      appArgs,
  });

  const signedTxn = appCallTxn.signTxn(sender.sk);
  const txId = appCallTxn.txID().toString();
  
  const result = await algodClient.sendRawTransaction(signedTxn).do();
  await waitForConfirmation(algodClient, txId, 4);

  console.log(`[Algorand] On-chain proof transaction successful with ID: ${txId}`);

  await recordShareInDb(cid, recipientAddress);

  return {
    message: "File shared and recorded on-chain successfully.",
    txId: txId,
    ...result
  };
};

export const payForStorageUpgrade = async (sender: AlgorandAccount, recipientAddress: string) => {
    console.log(`[Algorand] Initiating payment for storage upgrade from ${sender.addr}`);
    
    const params = await algodClient.getTransactionParams().do();
    console.log('[Algorand] Got transaction params.');

    const amount = UPGRADE_COST_ALGOS * 1_000_000; // to microAlgos

    const paymentTxn = makePaymentTxnWithSuggestedParamsFromObject({
        from: sender.addr,
        to: recipientAddress,
        amount,
        suggestedParams: params,
    });
    console.log(`[Algorand] Created payment transaction object for recipient ${recipientAddress}.`);

    const signedTxn = paymentTxn.signTxn(sender.sk);
    const txId = paymentTxn.txID().toString();
    console.log(`[Algorand] Signed transaction with ID: ${txId}`);

    await algodClient.sendRawTransaction(signedTxn).do();
    console.log('[Algorand] Sent raw transaction to the network.');
    
    await waitForConfirmation(algodClient, txId, 4);
    console.log(`[Algorand] Payment transaction confirmed on-chain.`);

    return { txId };
};
