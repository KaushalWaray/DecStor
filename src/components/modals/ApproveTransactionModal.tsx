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
import { LoaderCircle } from 'lucide-react';

interface ApproveTransactionModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onApprove: () => void;
  recipientAddress: string;
  networkFee: number;
  isLoading: boolean;
}

export default function ApproveTransactionModal({
  isOpen,
  onOpenChange,
  onApprove,
  recipientAddress,
  networkFee,
  isLoading,
}: ApproveTransactionModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">Approve Transaction</DialogTitle>
          <DialogDescription>Review the transaction details before approving.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 my-4 p-4 border rounded-md">
            <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Action</span>
                <span className="font-medium">Share File (via Smart Contract)</span>
            </div>
            <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Recipient</span>
                <span className="font-code text-primary">{truncateAddress(recipientAddress)}</span>
            </div>
            <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Network Fee</span>
                <span className="font-medium">{networkFee} ALGO</span>
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Reject
          </Button>
          <Button onClick={onApprove} disabled={isLoading}>
            {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
