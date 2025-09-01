
# This script compiles the PyTeal smart contract and deploys it
# to the Algorand TestNet.

import base64
from algosdk.v2client import algod
from algosdk import account, mnemonic, transaction
from pyteal import compileTeal, Mode
import os
import sys

# Add the parent directory to the Python path to allow for local imports.
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# --- Configuration for Algorand TestNet ---
ALGOD_ADDRESS = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN = ""

# --- Your Wallet Mnemonic ---
# IMPORTANT: REPLACE THIS WITH YOUR 25-WORD MNEMONIC PHRASE
CREATOR_MNEMONIC = "PASTE_YOUR_25_WORD_MNEMONIC_HERE"

# Initialize the Algorand client
algod_client = algod.AlgodClient(ALGOD_TOKEN, ALGOD_ADDRESS)

def compile_program(client, source_code):
    """ Compiles TEAL source code into bytecode. """
    try:
        compile_response = client.compile(source_code)
        return base64.b64decode(compile_response['result'])
    except Exception as e:
        print(f"Error during TEAL compilation: {e}")
        return None

def deploy_app(client, creator_mnemonic, approval_source, clear_source):
    """ Deploys the smart contract to the Algorand blockchain. """
    if creator_mnemonic == "PASTE_YOUR_25_WORD_MNEMONIC_HERE":
        print("ERROR: Please replace the placeholder mnemonic in deploy_contract.py")
        return None, None

    creator_private_key = mnemonic.to_private_key(creator_mnemonic)
    creator_address = account.address_from_private_key(creator_private_key)

    print("Deploying contract from account:", creator_address)

    # Compile the PyTeal programs
    approval_bytecode = compile_program(client, approval_source)
    clear_bytecode = compile_program(client, clear_source)

    if not approval_bytecode or not clear_bytecode:
        print("Failed to compile TEAL programs. Aborting.")
        return None, None

    # Get suggested transaction parameters
    params = client.suggested_params()

    # Define the state schema (not used in this version, but required)
    global_schema = transaction.StateSchema(num_uints=0, num_byte_slices=0)
    local_schema = transaction.StateSchema(num_uints=0, num_byte_slices=0)

    # Create the application creation transaction
    txn = transaction.ApplicationCreateTxn(
        sender=creator_address,
        sp=params,
        on_complete=transaction.OnComplete.NoOpOC,
        approval_program=approval_bytecode,
        clear_program=clear_bytecode,
        global_schema=global_schema,
        local_schema=local_schema,
        app_args=[],
    )

    # Sign and submit
    signed_txn = txn.sign(creator_private_key)
    try:
        txid = client.send_transaction(signed_txn)
        print(f"Transaction ID: {txid}")
        transaction.wait_for_confirmation(client, txid, 4)
        tx_response = client.pending_transaction_info(txid)
        app_id = tx_response["application-index"]
        print(f"Application deployed with ID: {app_id}")
        return app_id, txid
    except Exception as e:
        print(f"Error during transaction submission: {e}")
        return None, None

if __name__ == "__main__":
    from drive_contract import approval_program, clear_state_program
    
    approval_source = compileTeal(approval_program(), Mode.Application, version=6)
    clear_source = compileTeal(clear_state_program(), Mode.Application, version=6)
    
    app_id, txid = deploy_app(algod_client, CREATOR_MNEMONIC, approval_source, clear_source)
    
    if app_id:
        print("\nSmart contract deployment successful! 🎉")
        print(f"Application ID: {app_id}")
        print(f"Transaction ID: {txid}")
        print(f"\nACTION REQUIRED: Update the MAILBOX_APP_ID in `src/lib/constants.ts` to: {app_id}")
    else:
        print("\nSmart contract deployment failed.")
