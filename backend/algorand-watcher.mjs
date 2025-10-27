#!/usr/bin/env node
import algosdk from 'algosdk';
import fs from 'fs';
import fetch from 'node-fetch';

// Small watcher that scans recent confirmed rounds for application calls to the mailbox app
// and forwards bulk commit events to the backend via POST /api/bulk/commit.

const APP_ID = Number(process.env.MAILBOX_APP_ID || '748486979');
const ALGOD_SERVER = process.env.ALGOD_SERVER || 'https://testnet-api.algonode.cloud';
const ALGOD_PORT = process.env.ALGOD_PORT ? Number(process.env.ALGOD_PORT) : 443;
const ALGOD_TOKEN = process.env.ALGOD_TOKEN || '';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const STATE_FILE = process.env.STATE_FILE || './backend/watcher-state.json';
const POLL_INTERVAL = Number(process.env.POLL_INTERVAL_MS || '5000');

const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { lastRound: 0, processedTxs: [] };
  }
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[Watcher] Failed to save state:', e);
  }
}

function decodeLog(base64) {
  try {
    return Buffer.from(base64, 'base64').toString();
  } catch (e) {
    return String(base64);
  }
}

async function handleAppTxn(tx) {
  try {
    // tx may be in indexer or algod block shape. Normalize.
    const txid = tx.tx?.id || tx.id || tx.txid || tx.hash || tx['hash'];
    const sender = tx.tx?.txn?.snd ? algosdk.encodeAddress(tx.tx.txn.snd) : (tx['sender'] || tx.from || tx['tx']['txn']?.snd ? algosdk.encodeAddress(tx.tx.txn.snd) : undefined);

    // logs may live in application-transaction object (indexer) or in confirmed txn structure
    const logs = [];
    if (tx['logs']) {
      logs.push(...tx['logs']);
    }
    if (tx['transaction']?.logs) {
      logs.push(...tx['transaction'].logs);
    }
    if (tx['application-transaction']?.['logs']) {
      logs.push(...tx['application-transaction']['logs']);
    }
    // Note: other shapes of confirmed tx objects may contain logs in different
    // paths; above we cover the common cases returned by the indexer and
    // algod block responses.

    for (const l of logs) {
      const s = decodeLog(l);
      if (s.includes('|bulk|')) {
        console.log('[Watcher] Found bulk log in tx', txid, '->', s.substring(0, 120));
        // parse merkleRoot and count from pattern: <version>|bulk|<merkleRoot>|from|<sender>|count|<count>
        const parts = s.split('|');
        const version = parts[0];
        const action = parts[1];
        const merkleRoot = parts[2];
        let fromAddr = parts[4] || sender;
        const countPart = parts.find((p) => p.startsWith('count'));
        let count = 0;
        if (countPart) {
          // count may be encoded as binary Itob at the end; attempt to recover via parsing trailing bytes
          const last = parts[parts.length - 1];
          // try parse as int
          const maybe = parseInt(last, 10);
          if (!Number.isNaN(maybe)) count = maybe;
          else count = 0;
        } else {
          count = 0;
        }

        // POST to backend to record the merkle root; we don't have CID mapping so we only record commit
        try {
          const res = await fetch(`${BACKEND_URL}/api/bulk/commit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ merkleRoot, sender: fromAddr, count })
          });
          const j = await res.json();
          console.log('[Watcher] Backend response:', res.status, j.message || j.error || j);
        } catch (e) {
          console.error('[Watcher] Failed to POST to backend:', e);
        }
      }
    }
  } catch (e) {
    console.error('[Watcher] Error handling app txn:', e);
  }
}

async function scanOnce() {
  const state = loadState();
  const status = await algod.status().do();
  const lastRound = status['last-round'];
  let start = state.lastRound ? state.lastRound + 1 : Math.max(1, lastRound - 5);
  if (start > lastRound) start = lastRound;
  console.log('[Watcher] Scanning rounds', start, '->', lastRound);

  for (let r = start; r <= lastRound; r++) {
    try {
      const block = await algod.block(r).do();
      // Transactions may be under block.block.tx or block.block['tx'] or block.block['txns']
      const txns = block?.block?.tx || block?.block?.txns || block?.block?.txs || block?.block?.transactions || [];
      if (!Array.isArray(txns) || txns.length === 0) continue;
      for (const tx of txns) {
        try {
          // if this is a group transaction object from algod, it has 'txn' field with 'txn' inner
          const isAppCall = (tx?.txn?.txn?.type === 'appl') || (tx['tx-type'] === 'appl') || (tx?.tx?.txn?.type === 'appl');
          const appId = tx?.txn?.txn?.apid || tx?.['application-transaction']?.['application-id'] || tx?.['application-transaction']?.['application-id'] || tx?.appidx || tx?.apid;
          if (isAppCall && Number(appId) === APP_ID) {
            await handleAppTxn(tx);
          }
        } catch (e) {
          // per-transaction error
        }
      }
    } catch (e) {
      console.error('[Watcher] Error fetching block', r, e);
    }
    state.lastRound = r;
    saveState(state);
  }
}

async function main() {
  const once = process.argv.includes('--once') || process.env.ONCE === '1';
  console.log('[Watcher] Starting Algorand watcher for app', APP_ID, 'once=', once);
  if (once) {
    await scanOnce();
    console.log('[Watcher] Completed single scan. Exiting.');
    process.exit(0);
  }

  // continuous mode
  while (true) {
    try {
      await scanOnce();
    } catch (e) {
      console.error('[Watcher] Unexpected error in scan loop:', e);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
}

main().catch((e) => { console.error('[Watcher] Fatal error:', e); process.exit(1); });
