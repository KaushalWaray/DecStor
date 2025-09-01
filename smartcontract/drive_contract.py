from pyteal import *

def approval_program():
    """
    A simple approval program that allows any transaction with a note.
    This serves as a basic on-chain messenger.
    """
    return Approve()

def clear_state_program():
    """
    A simple clear state program that always approves.
    """
    return Approve()

if __name__ == "__main__":
    import os
    from algosdk.v2client import algod
    from algosdk import transaction

    # Write Approval Program
    approval_program_teal = compileTeal(approval_program(), mode=Mode.Application, version=6)
    with open(os.path.join(os.path.dirname(__file__), "approval.teal"), "w") as f:
        f.write(approval_program_teal)

    # Write Clear State Program
    clear_state_program_teal = compileTeal(clear_state_program(), mode=Mode.Application, version=6)
    with open(os.path.join(os.path.dirname(__file__), "clear.teal"), "w") as f:
        f.write(clear_state_program_teal)
