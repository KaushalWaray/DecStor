from pyteal import *


# Keys used in global state
G_CREATOR = Bytes("Creator")
G_VERSION = Bytes("Version")
G_FEE = Bytes("Fee")        # expected fee in microAlgos per single-share
G_SERVICE = Bytes("Service")


def validate_rekey_zero():
    return Assert(Txn.rekey_to() == Global.zero_address())


def validate_group_payment(required_amount: Expr):
    """Validate that the immediately preceding transaction in the group is a
    Payment from the same sender to the configured service address with at
    least required_amount microAlgos.

    This requires the client to construct the group as: [Payment, AppCall].
    """
    # must be grouped and not the first transaction
    return Seq(
        Assert(Global.group_size() > Int(1)),
        Assert(Txn.group_index() > Int(0)),
        # the payment tx is the previous tx in the group; reference fields directly
        Assert(Gtxn[Txn.group_index() - Int(1)].type_enum() == TxnType.Payment),
        Assert(Gtxn[Txn.group_index() - Int(1)].sender() == Txn.sender()),
        Assert(Gtxn[Txn.group_index() - Int(1)].receiver() == App.globalGet(G_SERVICE)),
        Assert(Gtxn[Txn.group_index() - Int(1)].amount() >= required_amount),
    )


def create_application():
    # On create we store the deployer as Creator, set a default version and fee
    # Accept optional args: [version_tag (bytes), fee_microalgos (uint64), service_address (addr)]
    default_fee = Int(1000)  # 0.001 Algo default

    fee_arg = If(Txn.application_args.length() > Int(1), Btoi(Txn.application_args[1]), default_fee)
    service_arg = If(Txn.application_args.length() > Int(2), Txn.application_args[2], Txn.sender())
    version_arg = If(Txn.application_args.length() > Int(0), Txn.application_args[0], Bytes("v1"))

    return Seq(
        validate_rekey_zero(),
        App.globalPut(G_CREATOR, Txn.sender()),
        App.globalPut(G_VERSION, version_arg),
        App.globalPut(G_FEE, fee_arg),
        App.globalPut(G_SERVICE, service_arg),
        Approve(),
    )


def is_creator():
    return Txn.sender() == App.globalGet(G_CREATOR)


def on_share():
    """Handle a single share proof.

    Expected app args: [version_tag, "share", cid, (optional) recipient]
    The transaction group must include a preceding payment that pays at least
    the configured fee to the service address.
    """
    version_check = Txn.application_args[0] == App.globalGet(G_VERSION)
    action_check = Txn.application_args[1] == Bytes("share")

    cid = Txn.application_args[2]
    recipient = If(Txn.application_args.length() > Int(3), Txn.application_args[3], Bytes(""))

    required_payment = App.globalGet(G_FEE)

    log_payload = Concat(
        App.globalGet(G_VERSION), Bytes("|share|"), cid, Bytes("|from|"), Txn.sender(), Bytes("|to|"), recipient
    )

    return Seq(
        validate_rekey_zero(),
        Assert(version_check),
        Assert(action_check),
        Assert(Txn.application_args.length() >= Int(3)),
        # validate payment group (this will Approve if valid)
        validate_group_payment(required_payment),
        # emit a concise log so off-chain services can parse the on-chain proof
        Log(log_payload),
        Approve(),
    )


def on_bulk_share():
    """Handle a bulk share by accepting a Merkle root that commits many CIDs.

    Expected app args: [version_tag, "bulk", merkle_root, count]
    The preceding payment must cover fee * count.
    """
    AssertArgs = Seq([])

    version_check = Txn.application_args[0] == App.globalGet(G_VERSION)
    action_check = Txn.application_args[1] == Bytes("bulk")

    merkle_root = Txn.application_args[2]
    count = Btoi(Txn.application_args[3])

    required_payment = Mul(App.globalGet(G_FEE), count)

    log_payload = Concat(
        App.globalGet(G_VERSION), Bytes("|bulk|"), merkle_root, Bytes("|from|"), Txn.sender(), Bytes("|count|"), Itob(count)
    )

    return Seq(
        validate_rekey_zero(),
        Assert(version_check),
        Assert(action_check),
        Assert(Txn.application_args.length() == Int(4)),
        # validate payment group (this will Approve if valid)
        validate_group_payment(required_payment),
        Log(log_payload),
        Approve(),
    )


def on_set_config():
    """Allow the creator to update minimal runtime config (fee, service).

    Expected app args: [version_tag, "set_config", fee (uint64)?, service_addr?]
    Only the creator may call this action.
    """
    return Seq(
        validate_rekey_zero(),
        Assert(is_creator()),
        # optional args: if provided update (use Seq() branches since App.globalPut returns None)
        If(Txn.application_args.length() > Int(2), Seq(App.globalPut(G_FEE, Btoi(Txn.application_args[2]))), Seq()),
        If(Txn.application_args.length() > Int(3), Seq(App.globalPut(G_SERVICE, Txn.application_args[3])), Seq()),
        Approve(),
    )


def approval_program():
    # Contract router
    handle_creation = create_application()

    handle_noop = Cond(
        [Txn.application_args[1] == Bytes("share"), on_share()],
        [Txn.application_args[1] == Bytes("bulk"), on_bulk_share()],
        [Txn.application_args[1] == Bytes("set_config"), on_set_config()],
    )

    handle_updateapp = Seq(
        validate_rekey_zero(),
        Assert(is_creator()),
        Approve(),
    )

    handle_deleteapp = Seq(
        validate_rekey_zero(),
        Assert(is_creator()),
        Approve(),
    )

    program = Cond(
        [Txn.application_id() == Int(0), handle_creation],

        # We don't support OptIn
        [Txn.on_completion() == OnComplete.OptIn, Reject()],

        [Txn.on_completion() == OnComplete.CloseOut, Approve()],

        [Txn.on_completion() == OnComplete.UpdateApplication, handle_updateapp],
        [Txn.on_completion() == OnComplete.DeleteApplication, handle_deleteapp],

        # NoOp (action router) - require at least two args: version and action
        [Txn.on_completion() == OnComplete.NoOp, Seq(
            Assert(Txn.application_args.length() >= Int(2)),
            handle_noop
        )],
    )

    return program


def clear_state_program():
    return Approve()


if __name__ == "__main__":
    import os

    here = os.path.dirname(__file__)
    with open(os.path.join(here, "approval.teal"), "w") as f:
        f.write(compileTeal(approval_program(), mode=Mode.Application, version=6))

    with open(os.path.join(here, "clear.teal"), "w") as f:
        f.write(compileTeal(clear_state_program(), mode=Mode.Application, version=6))
