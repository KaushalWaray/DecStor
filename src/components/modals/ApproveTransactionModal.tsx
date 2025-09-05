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
import { ALGO_NETWORK_FEE } from '@/lib/constants';


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
  amount
}: ApproveTransactionModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 my-4 p-4 border rounded-md">
            <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Action</span>
                <span className="font-medium">{actionText}</span>
            </div>
            {recipientAddress && (
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Recipient</span>
                    <span className="font-code text-primary">{truncateAddress(recipientAddress)}</span>
                </div>
            )}
            {amount !== undefined && (
                 <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-medium">{amount} ALGO</span>
                </div>
            )}
            <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Network Fee</span>
                <span className="font-medium">{ALGO_NETWORK_FEE} ALGO</span>
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
