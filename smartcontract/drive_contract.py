
from pyteal import *

def approval_program():
    """
    This smart contract manages file sharing for the MetaDrive wallet.

    It allows users to share a file's CID (Content Identifier from IPFS) with
    another Algorand address. The record of the share is stored on-chain in the
    recipient's local state for this application.

    Actions:
    - "share": The main action to share a file.
        - Transaction must include:
            1. The application argument "share".
            2. The CID of the file to be shared as the second argument.
            3. The recipient's address in the transaction's accounts array.
    """

    # ACTION: "share"
    # The transaction must have 1 application argument (the CID) and 1 account (the recipient).
    # The first argument to the contract call is the action name, e.g., "share".
    # The second argument is the file CID.
    # The second account in the transaction is the recipient.
    on_share = Seq([
        # Basic validation checks
        Assert(Txn.application_args.length() == Int(2)),
        Assert(Txn.accounts.length() == Int(1)),
        Assert(Txn.rekey_to() == Global.zero_address()),

        # The key for the local state will be the CID itself.
        # The value will be a confirmation marker (e.g., integer 1).
        # We store this in the RECIPIENT's local state.
        # Txn.accounts[1] refers to the first account in the foreign accounts array.
        App.localPut(
            Txn.accounts[1], # The recipient's address
            Txn.application_args[1], # The file CID as the key
            Int(1) # A value of 1 to indicate the file is shared
        ),
        Approve()
    ])


    # Main conditional router for the contract
    program = Cond(
        # On contract creation, just approve.
        [Txn.application_id() == Int(0), Approve()],

        # On OptIn to the contract, approve. This allows users to get a "mailbox".
        [Txn.on_completion() == OnComplete.OptIn, Approve()],

        # On CloseOut, approve.
        [Txn.on_completion() == OnComplete.CloseOut, Approve()],
        
        # On Update or Delete, reject. For this version, the contract is immutable.
        [Txn.on_completion() == OnComplete.UpdateApplication, Reject()],
        [Txn.on_completion() == OnComplete.DeleteApplication, Reject()],

        # Check the action from the application arguments.
        [Txn.application_args[0] == Bytes("share"), on_share]
    )

    return program


def clear_state_program():
    """
    Approves any clear state transaction.
    This is called when a user "closes out" their local state from the application.
    """
    return Approve()

if __name__ == "__main__":
    import os
    # The compileTeal function is what turns the PyTeal code into TEAL assembly
    with open(os.path.join(os.path.dirname(__file__), "approval.teal"), "w") as f:
        f.write(compileTeal(approval_program(), mode=Mode.Application, version=6))

    with open(os.path.join(os.path.dirname(__file__), "clear.teal"), "w") as f:
        f.write(compileTeal(clear_state_program(), mode=Mode.Application, version=6))
