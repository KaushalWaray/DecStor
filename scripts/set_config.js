const algosdk = require('algosdk');

const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';
const ALGOD_TOKEN = '';
const MAILBOX_APP_ID = 748486979;
const MAILBOX_APP_VERSION = 'v1';

async function main() {
  const creatorMnemonic = process.env.CREATOR_MNEMONIC;
  const serviceAddr = process.env.SERVICE_ADDR;
  if (!creatorMnemonic) {
    console.error('CREATOR_MNEMONIC env var is required');
    process.exit(1);
  }
  if (!serviceAddr) {
    console.error('SERVICE_ADDR env var is required');
    process.exit(1);
  }

  const client = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_TOKEN);

  const creator = algosdk.mnemonicToSecretKey(creatorMnemonic);
  console.log('Using creator address:', creator.addr);

  // Fetch app globals to get current fee
  let feeMicro = 1000;
  try {
    const app = await client.getApplicationByID(MAILBOX_APP_ID).do();
    const globals = app.params['global-state'] || [];
    for (const e of globals) {
      const key = Buffer.from(e.key, 'base64').toString();
      if (key === 'Fee' && e.value && e.value.uint !== undefined) {
        feeMicro = e.value.uint;
      }
    }
    console.log('Current on-chain fee:', feeMicro);
  } catch (err) {
    console.warn('Could not read app globals, using fallback fee:', feeMicro, err && err.message);
  }

  const params = await client.getTransactionParams().do();

  // appArgs: [version, 'set_config', fee(uint64), service(addr)]
  const appArgs = [
    new Uint8Array(Buffer.from(MAILBOX_APP_VERSION)),
    new Uint8Array(Buffer.from('set_config')),
    algosdk.encodeUint64(feeMicro),
  ];
  // Encode service address as raw 32-byte public key when passing to args
  try {
    const decoded = algosdk.decodeAddress(serviceAddr).publicKey;
    appArgs.push(new Uint8Array(decoded));
  } catch (err) {
    console.warn('Provided service address is not a valid Algorand address, sending as raw bytes fallback');
    appArgs.push(new Uint8Array(Buffer.from(serviceAddr)));
  }

  const txn = algosdk.makeApplicationNoOpTxnFromObject({
    from: creator.addr,
    suggestedParams: params,
    appIndex: MAILBOX_APP_ID,
    appArgs,
  });

  const signed = txn.signTxn(creator.sk);
  const txId = txn.txID().toString();
  console.log('Sending tx:', txId);

  try {
    const sendRes = await client.sendRawTransaction(signed).do();
    console.log('sendRawTransaction result:', sendRes);
    // wait for confirmation
    const confirmed = await algosdk.waitForConfirmation(client, txId, 4);
    console.log('Transaction confirmed in round', confirmed['confirmed-round']);
    // print logs or global state
    const pending = await client.pendingTransactionInformation(txId).do();
    console.log('pending tx info:', JSON.stringify(pending, null, 2));

    // Verify globals updated
    const appAfter = await client.getApplicationByID(MAILBOX_APP_ID).do();
    const globalsAfter = appAfter.params['global-state'] || [];
    const decoded = {};
    for (const e of globalsAfter) {
      const key = Buffer.from(e.key, 'base64').toString();
      if (e.value.uint !== undefined) decoded[key] = e.value.uint;
      else if (e.value.bytes) decoded[key] = Buffer.from(e.value.bytes, 'base64').toString();
    }
    console.log('App globals after update:', decoded);
  } catch (err) {
    console.error('Failed to send or confirm transaction:', err && err.message ? err.message : err);
    process.exit(2);
  }
}

main();
