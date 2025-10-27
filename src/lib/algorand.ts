

import algosdk, {Algodv2, generateAccount as generateAlgodAccount, secretKeyToMnemonic, mnemonicToSecretKey, waitForConfirmation, isValidAddress, makeApplicationNoOpTxnFromObject, makePaymentTxnWithSuggestedParamsFromObject, OnApplicationComplete} from 'algosdk';
import { ALGOD_SERVER, ALGOD_TOKEN, ALGOD_PORT, MAILBOX_APP_ID, MAILBOX_APP_VERSION, UPGRADE_COST_ALGOS } from './constants';
import type { AlgorandAccount, WalletEntry } from '@/types';
import { recordShareInDb, getFilesByOwner } from './api';
import { decryptMnemonic } from './crypto';

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
    // A valid mnemonic must be 25 words.
    if (mnemonic.trim().split(/\s+/g).length !== 25) {
      return false;
    }
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


export const sendPayment = async (sender: AlgorandAccount, recipientAddress: string, amountAlgos: number) => {
    console.log(`[Algorand] Initiating payment of ${amountAlgos} ALGO to ${recipientAddress}`);
    
    const params = await algodClient.getTransactionParams().do();
    const amountMicroAlgos = amountAlgos * 1_000_000;

    const paymentTxn = makePaymentTxnWithSuggestedParamsFromObject({
        from: sender.addr,
        to: recipientAddress,
        amount: amountMicroAlgos,
        suggestedParams: params,
    });

    const signedTxn = paymentTxn.signTxn(sender.sk);
    const txId = paymentTxn.txID().toString();
    
    await algodClient.sendRawTransaction(signedTxn).do();
    await waitForConfirmation(algodClient, txId, 4);
    
    console.log(`[Algorand] Payment transaction ${txId} confirmed.`);
    return { txId };
};


export const sendFile = async (
  sender: AlgorandAccount,
  recipientAddress: string,
  cid: string
): Promise<any> => {
  if (!isValidAddress(recipientAddress)) {
    throw new Error('Invalid recipient address');
  }

  // Preflight: ensure file metadata exists on the backend for this sender and cid
  try {
    const filesResult = await getFilesByOwner(sender.addr, '/', true);
    const found = (filesResult.files || []).some((f: any) => f.cid === cid);
    if (!found) {
      throw new Error('File metadata not found on backend. Please upload or save file metadata before sharing.');
    }
  } catch (err: any) {
    // bubble up clearly
    throw new Error(err?.message || 'Preflight check failed: could not verify file metadata.');
  }

  console.log(`[Algorand] Sending on-chain proof for sharing ${cid} with ${recipientAddress}`);

  // Fetch suggested params and on-chain globals (fee, service, version bytes)
  // Re-fetch suggested params and mailbox globals just before signing to avoid races
  const params = await algodClient.getTransactionParams().do();
  const { feeMicro, serviceAddr, versionBytes } = await getMailboxAppGlobals();

  // Verify sender balance is sufficient (fee + small network margin)
  try {
    const balanceAlgos = await getAccountBalance(sender.addr);
    const requiredAlgos = (feeMicro || 0) / 1_000_000 + 0.001; // include small margin for tx fees
    if (balanceAlgos < requiredAlgos) {
      throw new Error(`Insufficient balance: ${balanceAlgos.toFixed(6)} ALGO. Required ≥ ${requiredAlgos.toFixed(6)} ALGO to cover fee.`);
    }
  } catch (err: any) {
    throw new Error(err?.message || 'Failed to verify sender balance.');
  }

  let effectiveService = serviceAddr || sender.addr;
  if (!algosdk.isValidAddress(effectiveService)) {
    console.warn('[Algorand] serviceAddr from app globals is invalid or empty — falling back to sender address', effectiveService);
    effectiveService = sender.addr;
  }

  console.log(`[Algorand] Using service address ${effectiveService} and fee ${feeMicro} microAlgos`);

  // Build payment txn (must precede the app call and be from same sender)
  const paymentTxn = makePaymentTxnWithSuggestedParamsFromObject({
    from: sender.addr,
    to: effectiveService,
    amount: feeMicro,
    suggestedParams: params,
  });

  // App args: [version_bytes, "share", cid, recipient_raw_bytes]
  const appArgs: Uint8Array[] = [];
  if (versionBytes && versionBytes.length > 0) {
    appArgs.push(new Uint8Array(versionBytes));
  } else {
    appArgs.push(new Uint8Array(Buffer.from(MAILBOX_APP_VERSION)));
  }
  appArgs.push(new Uint8Array(Buffer.from('share')));
  appArgs.push(new Uint8Array(Buffer.from(cid)));

  // Recipient should be passed as raw 32-byte publicKey bytes where possible
  try {
    const raw = algosdk.decodeAddress(recipientAddress).publicKey;
    appArgs.push(new Uint8Array(raw));
  } catch (err) {
    // Fallback: append address string bytes (less ideal)
    console.warn('[Algorand] Could not decode recipient to raw bytes, appending address string bytes');
    appArgs.push(new Uint8Array(Buffer.from(recipientAddress)));
  }

  const appCallTxn = makeApplicationNoOpTxnFromObject({
    from: sender.addr,
    suggestedParams: params,
    appIndex: MAILBOX_APP_ID,
    appArgs,
  });

  // Group the payment and app call (payment must be the previous tx in the group)
  const txns = [paymentTxn, appCallTxn];
  algosdk.assignGroupID(txns);

  // Sign both transactions with the same sender key
  const signedPayment = paymentTxn.signTxn(sender.sk);
  const signedAppCall = appCallTxn.signTxn(sender.sk);

  const txId = appCallTxn.txID().toString();
  // Send combined signed transactions
  const combined = Buffer.concat([Buffer.from(signedPayment), Buffer.from(signedAppCall)]);
  const result = await algodClient.sendRawTransaction(combined).do();
  await waitForConfirmation(algodClient, txId, 4);

  console.log(`[Algorand] On-chain proof transaction successful with ID: ${txId}`);

  await recordShareInDb(cid, recipientAddress);

  return {
    message: 'File sent and recorded on-chain successfully.',
    txId: txId,
    ...result,
  };
};

export const payForStorageUpgrade = async (account: AlgorandAccount, pin: string, recipientAddress: string) => {
    console.log(`[Algorand] Initiating payment for storage upgrade from ${account.addr}`);

    // This function now requires the PIN to re-derive the secret key for signing.
    const storedWallets: WalletEntry[] = JSON.parse(localStorage.getItem('decstor_wallets') || '[]');
    const walletEntry = storedWallets.find(w => w.address === account.addr);
    if (!walletEntry) throw new Error("Could not find wallet credentials. Please try re-importing your wallet.");

    const mnemonic = await decryptMnemonic(walletEntry.encryptedMnemonic, pin);
    if (!mnemonic) throw new Error("Decryption failed. Please check your PIN and try again.");
    
    const sender = mnemonicToAccount(mnemonic);
    
    const params = await algodClient.getTransactionParams().do();
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

// Helper: read on-chain globals (Fee and Service) for the mailbox app
export const getMailboxAppGlobals = async (): Promise<{ feeMicro: number; serviceAddr: string; versionBytes: Uint8Array | null }> => {
  let feeMicro = 1000;
  let serviceAddr = '';
  let versionBytes: Uint8Array | null = null;
  try {
    const appInfo = await algodClient.getApplicationByID(MAILBOX_APP_ID).do();
    const globals = appInfo.params['global-state'] || [];
    for (const entry of globals) {
      const key = Buffer.from(entry.key, 'base64').toString();
      if (key === 'Fee' && entry.value && entry.value.type === 2) {
        feeMicro = entry.value.uint;
      }
      if (key === 'Service' && entry.value && entry.value.type === 1 && entry.value.bytes) {
        const raw = Buffer.from(entry.value.bytes, 'base64');
        // If stored as 32-byte public key, convert to address; otherwise treat as string
        try {
          if (raw.length === 32) {
            serviceAddr = algosdk.encodeAddress(raw);
          } else {
            serviceAddr = raw.toString();
          }
        } catch (err) {
          serviceAddr = raw.toString();
        }
      }
      if (key === 'Version' && entry.value && entry.value.type === 1 && entry.value.bytes) {
        versionBytes = new Uint8Array(Buffer.from(entry.value.bytes, 'base64'));
      }
    }
  } catch (err) {
    console.warn('[Algorand] Could not read mailbox app globals:', err);
  }
  // Validate the decoded service address; if malformed treat as unset
  if (!algosdk.isValidAddress(serviceAddr)) {
    serviceAddr = '';
  }
  return { feeMicro, serviceAddr, versionBytes };
};

// Bulk share: accept a Merkle root and count, create Payment covering fee*count and AppCall [version, 'bulk', merkle_root, count]
export const bulkShare = async (sender: AlgorandAccount, merkleRoot: string, count: number): Promise<any> => {
  if (!merkleRoot || count <= 0) throw new Error('Invalid merkle root or count');

  const params = await algodClient.getTransactionParams().do();
  const { feeMicro, serviceAddr } = await getMailboxAppGlobals();

  const totalPayment = BigInt(feeMicro) * BigInt(count);

  const paymentTxn = makePaymentTxnWithSuggestedParamsFromObject({
    from: sender.addr,
    to: serviceAddr || sender.addr,
    amount: Number(totalPayment),
    suggestedParams: params,
  });

  const appArgs = [
    new Uint8Array(Buffer.from(MAILBOX_APP_VERSION)),
    new Uint8Array(Buffer.from('bulk')),
    new Uint8Array(Buffer.from(merkleRoot)),
    algosdk.encodeUint64(count),
  ];

  const appCallTxn = makeApplicationNoOpTxnFromObject({
    from: sender.addr,
    suggestedParams: params,
    appIndex: MAILBOX_APP_ID,
    appArgs,
  });

  const txns = [paymentTxn, appCallTxn];
  algosdk.assignGroupID(txns);

  const signedPayment = paymentTxn.signTxn(sender.sk);
  const signedAppCall = appCallTxn.signTxn(sender.sk);

  const txId = appCallTxn.txID().toString();
  const combined = Buffer.concat([Buffer.from(signedPayment), Buffer.from(signedAppCall)]);
  const result = await algodClient.sendRawTransaction(combined).do();
  await waitForConfirmation(algodClient, txId, 4);

  return { message: 'Bulk share submitted', txId, ...result };
};

// Creator-only: set_config to update fee and/or service address. Pass feeMicro (number | undefined) and/or serviceAddr (string | undefined)
export const setConfig = async (creator: AlgorandAccount, feeMicro?: number, service?: string): Promise<any> => {
  const params = await algodClient.getTransactionParams().do();

  const appArgs: Uint8Array[] = [
    new Uint8Array(Buffer.from(MAILBOX_APP_VERSION)),
    new Uint8Array(Buffer.from('set_config')),
  ];
  if (feeMicro !== undefined) appArgs.push(algosdk.encodeUint64(feeMicro));
  if (service) {
    try {
      // Pass service address as raw 32-byte public key bytes
      const raw = algosdk.decodeAddress(service).publicKey;
      appArgs.push(new Uint8Array(raw));
    } catch (err) {
      // fallback: treat as raw bytes
      appArgs.push(new Uint8Array(Buffer.from(service)));
    }
  }

  const appCallTxn = makeApplicationNoOpTxnFromObject({
    from: creator.addr,
    suggestedParams: params,
    appIndex: MAILBOX_APP_ID,
    appArgs,
  });

  const signed = appCallTxn.signTxn(creator.sk);
  const txId = appCallTxn.txID().toString();
  const result = await algodClient.sendRawTransaction(signed).do();
  await waitForConfirmation(algodClient, txId, 4);

  return { message: 'Config updated', txId, ...result };
};

// Inform backend of a bulk commit mapping (merkleRoot -> CIDs)
export const postBulkCommit = async (merkleRoot: string, cids: string[], recipientAddress: string) => {
  try {
    // First try a relative API proxy (Next.js app router) so remote previews can reach backend
    const relativeUrl = '/api/bulk/commit';
    console.debug('[Algorand] Attempting POST bulk commit to relative URL', relativeUrl);
    try {
      const r = await fetch(relativeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merkleRoot, sender: recipientAddress, count: cids.length, cids, recipientAddress })
      });
      const textRel = await r.text();
      try { const jsonRel = textRel ? JSON.parse(textRel) : {}; if (!r.ok) throw new Error(jsonRel.error || jsonRel.message || `Status ${r.status}`); return jsonRel; } catch (e) {
        if (!r.ok) throw new Error(`Proxy returned status ${r.status}: ${textRel.substring(0,200)}`);
        return { message: textRel };
      }
    } catch (proxyErr) {
      console.debug('[Algorand] Relative proxy failed, falling back to backend URL. Proxy error:', proxyErr);

      const backend = (process.env.NEXT_PUBLIC_BACKEND_URL as string) || 'http://localhost:3001';
      const url = `${backend.replace(/\/$/, '')}/api/bulk/commit`;
      console.debug('[Algorand] POST bulk commit to', url);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merkleRoot, sender: recipientAddress, count: cids.length, cids, recipientAddress })
      });
      const text = await res.text();
      try {
        const json = text ? JSON.parse(text) : {};
        if (!res.ok) throw new Error(json.error || json.message || `Backend returned status ${res.status}`);
        return json;
      } catch (parseErr) {
        if (!res.ok) {
          throw new Error(`Backend returned status ${res.status}: ${text.substring(0, 200)}`);
        }
        return { message: text };
      }
    }

    // (Either the relative proxy branch or fallback returned above)
  } catch (err) {
    console.error('[Algorand] Failed to post bulk commit to backend:', err);
    // Provide a clearer error for network failures
    const msg = (err instanceof Error && err.message) ? err.message : String(err);
    throw new Error(`Failed to reach backend to record bulk commit. Ensure the backend is running and NEXT_PUBLIC_BACKEND_URL is set correctly. Details: ${msg}`);
  }
};
