
from pyteal import *

def approval_program():
    """
    This smart contract serves as a simple, immutable on-chain record for a file share.
    It does NOT store state about who shared what. Instead, its purpose is to
    validate and approve a transaction that acts as a public "proof of share."

    The application backend is responsible for storing and retrieving the actual
    share details for the user-facing inbox.

    Actions:
    - "share": The main action to create a proof-of-share transaction.
        - Transaction must include:
            1. The application argument "share".
            2. The CID of the file that was shared as the second argument.
    
    This contract intentionally does not use local or global state to avoid
    the need for users to opt-in.
    """

    # For a "share" transaction, we just verify it has the correct number of arguments.
    # The existence of this transaction on the blockchain is the proof.
    on_share = Seq([
        Assert(Txn.application_args.length() == Int(2)), # Expect "share" and a CID
        Assert(Txn.rekey_to() == Global.zero_address()), # Security check
        Approve()
    ])


    # Main conditional router for the contract
    program = Cond(
        # On contract creation, just approve.
        [Txn.application_id() == Int(0), Approve()],

        # No OptIn needed as we are not using local state.
        [Txn.on_completion() == OnComplete.OptIn, Reject()],

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
    """
    return Approve()

if __name__ == "__main__":
    import os
    # The compileTeal function is what turns the PyTeal code into TEAL assembly
    with open(os.path.join(os.path.dirname(__file__), "approval.teal"), "w") as f:
        f.write(compileTeal(approval_program(), mode=Mode.Application, version=6))

    with open(os.path.join(os.path.dirname(__file__), "clear.teal"), "w") as f:
        f.write(compileTeal(clear_state_program(), mode=Mode.Application, version=6))
