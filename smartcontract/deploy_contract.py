
import os
import base64
from algosdk.v2client import algod
from algosdk import mnemonic, transaction

# --- User Configuration ---
# IMPORTANT: Never commit mnemonic to a public repository.
# Replace with your 25-word mnemonic phrase.
# You can get a new one for testing from https://testnet.algorand.network/dispenser
SENDER_MNEMONIC = "PASTE_YOUR_25_WORD_MNEMONIC_PHRASE_HERE"

# --- Algorand Node Configuration ---
# Using Algonode for TestNet access
ALGOD_ADDRESS = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN = "" # Token is empty for public access to Algonode

def get_private_key_from_mnemonic(mn):
    """Converts a mnemonic to a private key."""
    private_key = mnemonic.to_private_key(mn)
    return private_key

def compile_program(client, source_code):
    """Compiles TEAL source code to bytecode."""
    compile_response = client.compile(source_code)
    return base64.b64decode(compile_response['result'])

def create_application(client, private_key, approval_program_source, clear_program_source):
    """Deploys the smart contract to the Algorand network."""
    sender = mnemonic.to_public_key(SENDER_MNEMONIC)
    
    # Get suggested transaction parameters
    params = client.suggested_params()
    
    # Read and compile the TEAL programs
    with open(approval_program_source, "r") as f:
        approval_source = f.read()
    with open(clear_program_source, "r") as f:
        clear_source = f.read()

    approval_program_compiled = compile_program(client, approval_source)
    clear_program_compiled = compile_program(client, clear_source)

    # Define contract schema. 
    # Our contract is now stateless, so we use empty schemas.
    global_schema = transaction.StateSchema(num_uints=0, num_byte_slices=0)
    local_schema = transaction.StateSchema(num_uints=0, num_byte_slices=0) 
    
    # Create the unsigned transaction
    txn = transaction.ApplicationCreateTxn(
        sender=sender,
        sp=params,
        on_complete=transaction.OnComplete.NoOpOC,
        approval_program=approval_program_compiled,
        clear_program=clear_program_compiled,
        global_schema=global_schema,
        local_schema=local_schema
    )
    
    # Sign the transaction
    signed_txn = txn.sign(private_key)
    tx_id = signed_txn.transaction.get_txid()
    
    # Send the transaction to the network
    client.send_transactions([signed_txn])
    
    # Wait for confirmation
    try:
        confirmed_txn = transaction.wait_for_confirmation(client, tx_id, 4)
        app_id = confirmed_txn['application-index']
        print("=" * 50)
        print(f"🎉 Smart Contract Deployed Successfully! 🎉")
        print(f"Transaction ID: {tx_id}")
        print(f"Application ID: {app_id}")
        print("=" * 50)
        print("\nACTION REQUIRED:")
        print(f"Please copy the Application ID '{app_id}' and provide it back.")
        return app_id
    except Exception as err:
        print("An error occurred during deployment:", err)
        return None

if __name__ == "__main__":
    if SENDER_MNEMONIC == "PASTE_YOUR_25_WORD_MNEMONIC_PHRASE_HERE":
        print("\nERROR: Please update the SENDER_MNEMONIC in smartcontract/deploy_contract.py before running.")
    else:
        # Initialize Algod client
        algod_client = algod.AlgodClient(ALGOD_TOKEN, ALGOD_ADDRESS)
        sender_private_key = get_private_key_from_mnemonic(SENDER_MNEMONIC)

        # Get the absolute path to the TEAL files
        script_dir = os.path.dirname(__file__)
        approval_path = os.path.join(script_dir, "approval.teal")
        clear_path = os.path.join(script_dir, "clear.teal")
        
        # Compile PyTeal to TEAL first if files don't exist
        if not os.path.exists(approval_path) or not os.path.exists(clear_path):
            print("Compiling PyTeal to TEAL...")
            # This command assumes `python3` is available in the environment's path
            os.system(f"python3 {os.path.join(script_dir, 'drive_contract.py')}")
            print("Compilation complete.")

        create_application(algod_client, sender_private_key, approval_path, clear_path)
