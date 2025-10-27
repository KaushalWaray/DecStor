#!/usr/bin/env node
import fs from 'fs';
import crypto from 'crypto';
import algosdk from 'algosdk';

// Usage: node run_bulk_test.mjs <count>
const [,, countArg] = process.argv;
const COUNT = parseInt(countArg || '3', 10);
if (!COUNT || COUNT <= 0) {
  console.error('Provide a positive integer count as the first argument');
  process.exit(2);
}

const APP_ID = 748486979;
const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';
const ALGOD_PORT = 443;
const ALGOD_TOKEN = '';

// Load service mnemonic from backend/.env or env
let serviceMnemonic = process.env.SERVICE_WALLET_MNEMONIC;
try {
  if (!serviceMnemonic) {
    const envContent = fs.readFileSync(new URL('../backend/.env', import.meta.url), 'utf8');
    const m = envContent.match(/SERVICE_WALLET_MNEMONIC\s*=\s*"([^"]+)"/);
    if (m) serviceMnemonic = m[1];
  }
} catch (err) {}

if (!serviceMnemonic) {
  console.error('SERVICE_WALLET_MNEMONIC not found in env or backend/.env');
  process.exit(3);
}

const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);
const sender = algosdk.mnemonicToSecretKey(serviceMnemonic);

async function getGlobals() {
  const info = await algod.getApplicationByID(APP_ID).do();
  const globals = info.params['global-state'] || [];
  let fee = 1000;
  let serviceAddr = '';
  let versionBytes = null;
  for (const e of globals) {
    const key = Buffer.from(e.key, 'base64').toString();
    if (key === 'Fee' && e.value && e.value.type === 2) fee = e.value.uint;
    if (key === 'Service' && e.value && e.value.type === 1 && e.value.bytes) {
      const raw = Buffer.from(e.value.bytes, 'base64');
      if (raw.length === 32) serviceAddr = algosdk.encodeAddress(raw);
      else serviceAddr = raw.toString();
    }
    if (key === 'Version' && e.value && e.value.type === 1 && e.value.bytes) {
      versionBytes = Buffer.from(e.value.bytes, 'base64');
    }
  }
  return { fee, serviceAddr, versionBytes };
}

function makeDummyCid() {
  // not a real IPFS CID, but unique string for testing
  return 'Qm' + crypto.randomBytes(16).toString('hex');
}

async function main() {
  console.log('Using sender:', sender.addr);
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

  // Create dummy metadata entries on backend
  const cids = [];
  for (let i = 0; i < COUNT; i++) {
    const cid = makeDummyCid();
    cids.push(cid);
    const meta = {
      filename: `bulk-${i}-${cid}.bin`,
      cid,
      size: 1024 + i,
      fileType: 'application/octet-stream',
      owner: sender.addr,
      path: '/',
    };
    const res = await fetch(`${backendUrl}/api/files/metadata`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(meta)
    });
    const j = await res.json();
    console.log('Created metadata:', res.status, j.message || j.error || j);
  }

  // Compute a simple Merkle-like root: SHA256(concat(cids))
  const concat = cids.join('|');
  const merkleRoot = crypto.createHash('sha256').update(concat).digest('hex');
  console.log('Merklish root (sha256 hex):', merkleRoot);

  const params = await algod.getTransactionParams().do();
  const { fee, serviceAddr, versionBytes } = await getGlobals();
  console.log('App globals:', { fee, serviceAddr, versionBytes: versionBytes ? versionBytes.toString() : null });

  // Payment amount = fee * COUNT
  const totalPayment = BigInt(fee) * BigInt(COUNT);

  const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: sender.addr, to: serviceAddr || sender.addr, amount: Number(totalPayment), suggestedParams: params
  });

  const appArgs = [];
  if (versionBytes) appArgs.push(new Uint8Array(versionBytes)); else appArgs.push(new Uint8Array(Buffer.from('v1')));
  appArgs.push(new Uint8Array(Buffer.from('bulk')));
  appArgs.push(new Uint8Array(Buffer.from(merkleRoot)));
  appArgs.push(algosdk.encodeUint64(COUNT));

  const appCall = algosdk.makeApplicationNoOpTxnFromObject({ from: sender.addr, suggestedParams: params, appIndex: APP_ID, appArgs });

  const txns = [payTxn, appCall];
  algosdk.assignGroupID(txns);

  const signedPay = payTxn.signTxn(sender.sk);
  const signedApp = appCall.signTxn(sender.sk);
  const combined = Buffer.concat([Buffer.from(signedPay), Buffer.from(signedApp)]);

  console.log('Submitting grouped bulk-share transaction...');
  const sendRes = await algod.sendRawTransaction(combined).do();
  const payTxId = payTxn.txID().toString();
  const appTxId = appCall.txID().toString();
  console.log('Submitted grouped tx - payment txId:', sendRes.txId, ' appCall txId:', appTxId);

  // Wait for confirmation of the app-call transaction (second txn in group)
  const conf = await algosdk.waitForConfirmation(algod, appTxId, 4);
  console.log('Confirmed:', conf['confirmed-round']);

  // Extract logs from confirmed application call transaction
  const txInfo = await algod.pendingTransactionInformation(appTxId).do();
  const logs = (txInfo?.transaction?.logs) || (conf?.logs) || (conf?.txn?.txn?.logs) || [];
  console.log('On-chain logs:', logs.map(l => Buffer.from(l, 'base64').toString()));

  // Verify merkle root presence in logs
  const logsStr = logs.map(l => Buffer.from(l, 'base64').toString()).join('\n');
  if (logsStr.includes(merkleRoot)) {
    console.log('SUCCESS: Merkle root found in on-chain logs');
  } else {
    console.warn('WARNING: Merkle root not found in logs');
  }

  // Verify backend metadata exists for sender
  const filesRes = await fetch(`${backendUrl}/api/files/${sender.addr}?recursive=true`);
  const filesJson = await filesRes.json();
  const backendCids = (filesJson.files || []).map(f => f.cid);
  const missing = cids.filter(c => !backendCids.includes(c));
  if (missing.length === 0) console.log('All metadata entries present in backend.');
  else console.warn('Missing metadata in backend for cids:', missing);

  // Optionally create share records for each cid to simulate backend processing
  // POST the mapping in one call to /api/bulk/commit so backend can create per-CID shares
  try {
    const res = await fetch(`${backendUrl}/api/bulk/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merkleRoot, sender: sender.addr, count: cids.length, cids, recipientAddress: sender.addr })
    });
    const j = await res.json();
    console.log('Bulk commit response:', res.status, j.message || j.error || j);
  } catch (e) {
    console.error('Failed to POST bulk commit mapping to backend:', e);
  }

  console.log('Bulk-share test completed.');
}

main().catch(err => { console.error('Bulk test failed:', err); process.exit(1); });
