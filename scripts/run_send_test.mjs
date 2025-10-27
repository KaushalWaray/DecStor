#!/usr/bin/env node
import fs from 'fs';
import algosdk from 'algosdk';

// Simple end-to-end share test script.
// Usage: node run_send_test.mjs <cid> <recipient_address>

const APP_ID = 748486979;
const APP_VERSION = 'v1';
const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';
const ALGOD_PORT = 443;
const ALGOD_TOKEN = '';

const [,, cid, recipient] = process.argv;
if (!cid) {
  console.error('Usage: node run_send_test.mjs <cid> <recipient_address>');
  process.exit(2);
}

// Read backend/.env to get SERVICE_WALLET_MNEMONIC (fallback to env)
let serviceMnemonic = process.env.SERVICE_WALLET_MNEMONIC;
try {
  if (!serviceMnemonic) {
    const envContent = fs.readFileSync(new URL('../backend/.env', import.meta.url), 'utf8');
    const m = envContent.match(/SERVICE_WALLET_MNEMONIC\s*=\s*"([^"]+)"/);
    if (m) serviceMnemonic = m[1];
  }
} catch (err) {
  // ignore
}

if (!serviceMnemonic) {
  console.error('No SERVICE_WALLET_MNEMONIC found in environment or backend/.env');
  process.exit(3);
}

const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);

const sender = algosdk.mnemonicToSecretKey(serviceMnemonic);

async function getGlobals() {
  const info = await algod.getApplicationByID(APP_ID).do();
  const globals = info.params['global-state'] || [];
  let fee = 1000;
  let serviceAddr = '';
  for (const e of globals) {
    const key = Buffer.from(e.key, 'base64').toString();
    if (key === 'Fee' && e.value && e.value.type === 2) fee = e.value.uint;
    if (key === 'Service' && e.value && e.value.type === 1 && e.value.bytes) {
      const raw = Buffer.from(e.value.bytes, 'base64');
      if (raw.length === 32) serviceAddr = algosdk.encodeAddress(raw);
      else serviceAddr = raw.toString();
    }
  }
  return { fee, serviceAddr };
}

async function run() {
  try {
    console.log('Using sender:', sender.addr);
    const params = await algod.getTransactionParams().do();
    const { fee, serviceAddr } = await getGlobals();
    console.log('App globals:', { fee, serviceAddr });

    const toAddr = recipient || serviceAddr || sender.addr;
    if (!algosdk.isValidAddress(toAddr)) {
      console.error('Recipient/service address is invalid:', toAddr);
      process.exit(4);
    }

    // Build payment txn
    const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from: sender.addr,
      to: serviceAddr || sender.addr,
      amount: fee,
      suggestedParams: params,
    });

    // Build app args: [version, 'share', cid, recipient(publicKey raw bytes)]
    const appArgs = [new Uint8Array(Buffer.from(APP_VERSION)), new Uint8Array(Buffer.from('share')), new Uint8Array(Buffer.from(cid))];
    try {
      const recRaw = algosdk.decodeAddress(toAddr).publicKey;
      appArgs.push(new Uint8Array(recRaw));
    } catch (err) {
      console.warn('Could not decode recipient to raw publicKey bytes, appending as string');
      appArgs.push(new Uint8Array(Buffer.from(toAddr)));
    }

    const appCall = algosdk.makeApplicationNoOpTxnFromObject({
      from: sender.addr,
      suggestedParams: params,
      appIndex: APP_ID,
      appArgs,
    });

    const txns = [payTxn, appCall];
    const groupId = algosdk.computeGroupID(txns);
    txns[0].group = groupId;
    txns[1].group = groupId;

    const signedPay = payTxn.signTxn(sender.sk);
    const signedApp = appCall.signTxn(sender.sk);
    const combined = Buffer.concat([Buffer.from(signedPay), Buffer.from(signedApp)]);

    console.log('Sending grouped transaction...');
    const sendResult = await algod.sendRawTransaction(combined).do();
    const txId = sendResult.txId || appCall.txID().toString();
    console.log('Submitted txId:', txId);
    const conf = await algosdk.waitForConfirmation(algod, txId, 4);
    console.log('Confirmation:', conf);

    // After on-chain success, call backend API to record the share (mimic client behavior)
    try {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
      const fetchRes = await fetch(`${backendUrl}/api/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cid, recipientAddress: toAddr }),
      });
      const json = await fetchRes.json();
      console.log('Backend /api/share response:', fetchRes.status, json);

      // If the file wasn't found, attempt to create a metadata entry (use reasonable defaults)
      if (fetchRes.status === 404) {
        console.log('File not found on backend; attempting to create metadata entry and retry share...');
        const defaultMetadata = {
          filename: `uploaded-${cid}.bin`,
          cid,
          size: 1024,
          fileType: 'application/octet-stream',
          owner: toAddr, // set owner to recipient for testing purposes
          path: '/',
        };
        const metaRes = await fetch(`${backendUrl}/api/files/metadata`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(defaultMetadata),
        });
        const metaJson = await metaRes.json();
        console.log('Backend /api/files/metadata response:', metaRes.status, metaJson);

        if (metaRes.ok) {
          const retryRes = await fetch(`${backendUrl}/api/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cid, recipientAddress: toAddr }),
          });
          console.log('Retry /api/share response:', retryRes.status, await retryRes.json());
        }
      }
    } catch (err) {
      console.warn('Failed to call backend /api/share:', err);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error during send test:');
    if (err.response && err.response.text) {
      try { console.error(await err.response.text()); } catch(e) { console.error(err); }
    } else {
      console.error(err);
    }
    process.exit(5);
  }
}

run();
