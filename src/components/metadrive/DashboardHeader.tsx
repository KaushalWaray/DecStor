
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { truncateAddress } from '@/lib/utils';
import type { AlgorandAccount, User } from '@/types';
import { LogOut, Shield, Copy, LoaderCircle, Users, ChevronDown, ArrowUpRight, ArrowDownLeft, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import ReceiveModal from '../modals/ReceiveModal';
import SendModal from '../modals/SendModal';
import ApproveTransactionModal from '../modals/ApproveTransactionModal';
import RenameWalletModal from '../modals/RenameWalletModal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';


interface DashboardHeaderProps {
  account: AlgorandAccount;
  user: User;
  balance: number | null;
  onLock: () => void;
  onGoToManager: () => void;
  onConfirmSend: (recipient: string, amount: number) => Promise<boolean>;
  onRenameWallet: (newName: string) => Promise<boolean>;
  onDeleteActiveWallet: (address: string) => void;
}

export default function DashboardHeader({ account, user, balance, onLock, onGoToManager, onConfirmSend, onRenameWallet, onDeleteActiveWallet }: DashboardHeaderProps) {
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  
  // State for sending ALGO
  const [isApproveSendModalOpen, setIsApproveSendModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendDetails, setSendDetails] = useState<{recipient: string, amount: number} | null>(null);

  const { toast } = useToast();

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(account.addr);
    toast({ title: "Address copied!" });
  };

  const handleInitiateSend = (recipient: string, amount: number) => {
    setSendDetails({ recipient, amount });
    setIsSendModalOpen(false);
    setIsApproveSendModalOpen(true);
  };

  const handleConfirmSend = async () => {
    if (!sendDetails) return;
    
    setIsSending(true);
    await onConfirmSend(sendDetails.recipient, sendDetails.amount);
    setIsSending(false);
    setIsApproveSendModalOpen(false);
    setSendDetails(null);
  };

  const handleDelete = () => {
    onDeleteActiveWallet(account.addr);
    setIsDeleteConfirmOpen(false);
  }


  return (
    <>
    <header className="flex items-center justify-between p-4 bg-card rounded-lg shadow-md">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-headline font-bold">DecStor</h1>
      </div>
      <div className="flex items-center gap-4">

        <div className="flex items-center gap-2">
            <Button onClick={() => setIsSendModalOpen(true)}>
                <ArrowUpRight className="mr-2 h-4 w-4"/> Send
            </Button>
             <Button variant="secondary" onClick={() => setIsReceiveModalOpen(true)}>
                <ArrowDownLeft className="mr-2 h-4 w-4"/> Receive
            </Button>
        </div>

        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10">
                    <div className="flex items-center gap-2">
                        <div className="text-right">
                            <p className="font-semibold text-sm">{user.walletName}</p>
                             <p className="font-code text-xs text-muted-foreground hidden sm:block">{truncateAddress(account.addr)}</p>
                        </div>
                         <ChevronDown className="h-4 w-4 text-muted-foreground"/>
                    </div>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                 <DropdownMenuItem className="flex-col items-start disabled:opacity-100" disabled>
                    <div className="font-semibold">Balance</div>
                    <div className="font-semibold text-primary text-lg">
                        {balance === null ? (
                        <LoaderCircle className="h-4 w-4 animate-spin inline-block" />
                        ) : (
                        `${balance.toFixed(4)} ALGO`
                        )}
                    </div>
                 </DropdownMenuItem>
                 <DropdownMenuSeparator />
                 <DropdownMenuItem onClick={() => setIsRenameModalOpen(true)}>
                    <Edit className="mr-2 h-4 w-4" />
                    <span>Rename Wallet</span>
                </DropdownMenuItem>
                 <DropdownMenuItem onClick={handleCopyAddress}>
                    <Copy className="mr-2 h-4 w-4" />
                    <span>Copy Address</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onGoToManager}>
                    <Users className="mr-2 h-4 w-4" />
                    <span>Manage Wallets</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onLock}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Lock Wallet</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => setIsDeleteConfirmOpen(true)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete Wallet</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

    <ReceiveModal 
        isOpen={isReceiveModalOpen}
        onOpenChange={setIsReceiveModalOpen}
        address={account.addr}
    />
    
    <SendModal 
        isOpen={isSendModalOpen}
        onOpenChange={setIsSendModalOpen}
        onConfirm={handleInitiateSend}
        isLoading={isSending}
        balance={balance ?? 0}
        account={account}
    />

    {sendDetails && (
        <ApproveTransactionModal
            isOpen={isApproveSendModalOpen}
            onOpenChange={setIsApproveSendModalOpen}
            onApprove={handleConfirmSend}
            isLoading={isSending}
            title="Approve Transaction"
            description="You are about to send ALGO to another wallet. Please review the details carefully."
            actionText={`Send ${sendDetails.amount} ALGO`}
            recipientAddress={sendDetails.recipient}
            amount={sendDetails.amount}
      />
    )}

    <RenameWalletModal
      isOpen={isRenameModalOpen}
      onOpenChange={setIsRenameModalOpen}
      currentName={user.walletName}
      onConfirm={onRenameWallet}
    />

    <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive" />Delete Wallet?</AlertDialogTitle>
                <AlertDialogDescription>
                    Are you sure you want to delete the wallet <span className="font-bold text-foreground">{user.walletName}</span>? This will remove it from this device, but it does not delete the account from the blockchain. You can always re-import it later with the recovery phrase.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    </>
  );
}
