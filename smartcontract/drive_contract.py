
from pyteal import *

# This is the simplified PyTeal smart contract for MetaDrive.
# It provides an immutable, on-chain record of file sharing events.

def approval_program():
    """
    The approval program defines the contract's logic.
    """
    
    # This subroutine handles the posting of a new CID.
    # It creates an on-chain record without using expensive global state.
    @Subroutine(TealType.uint64)
    def post_cid():
        """
        Validates and accepts a CID post.
        The CID and recipient are implicitly stored in the transaction record.
        """
        # We expect 2 app arguments: the command "post_cid" and the CID itself.
        # We also expect 1 account to be passed: the recipient.
        is_valid_call = And(
            Txn.application_args.length() == Int(2),
            Txn.application_args[0] == Bytes("post_cid"),
            Txn.accounts.length() == Int(1)
        )
        
        return Seq(
            Assert(is_valid_call),
            Return(Int(1)) # Approve the transaction
        )

    # Main router for the contract logic
    program = Cond(
        # On creation, approve
        [Txn.application_id() == Int(0), Return(Int(1))],
        
        # On NoOp calls, route to the correct subroutine
        [Txn.on_completion() == OnComplete.NoOp, Return(post_cid())],
        
        # Reject and disallow other transaction types to enhance security
        [Txn.on_completion() == OnComplete.DeleteApplication, Return(Int(0))],
        [Txn.on_completion() == OnComplete.UpdateApplication, Return(Int(0))],
        [Txn.on_completion() == OnComplete.CloseOut, Return(Int(0))],
        [Txn.on_completion() == OnComplete.OptIn, Return(Int(0))]
    )
    
    return program

def clear_state_program():
    """
    The clear state program is executed when an account clears its local state.
    This contract does not use local state, so we simply approve.
    """
    return Return(Int(1))

# This block is for compiling the contract to TEAL.
if __name__ == "__main__":
    approval_teal = compileTeal(approval_program(), Mode.Application, version=6)
    clear_teal = compileTeal(clear_state_program(), Mode.Application, version=6)
    
    with open("drive_approval.teal", "w") as f:
        f.write(approval_teal)
    
    with open("drive_clear.teal", "w") as f:
        f.write(clear_teal)
