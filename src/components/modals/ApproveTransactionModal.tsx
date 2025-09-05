
"use client";

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { truncateAddress } from '@/lib/utils';
import { LoaderCircle, FileText, Wallet } from 'lucide-react';
import { ALGO_NETWORK_FEE } from '@/lib/constants';
import type { FileMetadata } from '@/types';


interface ApproveTransactionModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onApprove: () => void;
  isLoading: boolean;
  title: string;
  description: string;
  actionText: string;
  recipientAddress?: string;
  amount?: number;
  file?: FileMetadata; // New prop for file details
}

export default function ApproveTransactionModal({
  isOpen,
  onOpenChange,
  onApprove,
  isLoading,
  title,
  description,
  actionText,
  recipientAddress,
  amount,
  file,
}: ApproveTransactionModalProps) {
  const isSendingAlgo = amount !== undefined;
  const isSendingFile = file !== undefined;
  const isUpgrade = title.toLowerCase().includes('upgrade');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2">
            { isSendingAlgo ? <Wallet/> : <FileText/> }
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 my-4 p-4 border rounded-md">
            {isSendingFile && (
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">File</span>
                    <span className="font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        {file.filename}
                    </span>
                </div>
            )}
             { (isSendingAlgo || isUpgrade) && (
                 <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-medium">{amount} ALGO</span>
                </div>
            )}
            {recipientAddress && (
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Recipient</span>
                    <span className="font-code text-primary">{truncateAddress(recipientAddress)}</span>
                </div>
            )}
            <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Network Fee</span>
                <span className="font-medium">{ALGO_NETWORK_FEE} ALGO</span>
            </div>
             <div className="flex justify-between items-center border-t pt-4 mt-4">
                <span className="text-muted-foreground font-bold">Total</span>
                <span className="font-bold text-primary">
                    { isSendingAlgo || isUpgrade ? (amount! + ALGO_NETWORK_FEE).toFixed(4) : ALGO_NETWORK_FEE } ALGO
                </span>
            </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Reject
          </Button>
          <Button onClick={onApprove} disabled={isLoading}>
            {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            {actionText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
