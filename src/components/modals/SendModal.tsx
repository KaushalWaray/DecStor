
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import algosdk from 'algosdk';
import { LoaderCircle, Send, Wallet } from 'lucide-react';
import { ALGO_NETWORK_FEE } from '@/lib/constants';

interface SendModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (recipient: string, amount: number) => void;
  isLoading: boolean;
  balance: number;
}

export default function SendModal({ isOpen, onOpenChange, onConfirm, isLoading, balance }: SendModalProps) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const { toast } = useToast();

  const handleConfirm = () => {
    if (!algosdk.isValidAddress(recipient)) {
      toast({ variant: 'destructive', title: 'Invalid Address', description: 'Please enter a valid Algorand address.' });
      return;
    }
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Please enter a valid amount to send.' });
      return;
    }
    if (numericAmount + ALGO_NETWORK_FEE > balance) {
        toast({ variant: 'destructive', title: 'Insufficient Funds', description: 'You do not have enough ALGO to complete this transaction.' });
        return;
    }

    onConfirm(recipient, numericAmount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2"><Send/>Send ALGO</DialogTitle>
          <DialogDescription>Enter the recipient's address and the amount to send.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 my-4">
            <div className="p-3 rounded-md bg-muted text-sm">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Your Balance</span>
                    <span className="font-medium flex items-center gap-1.5">
                        <Wallet className="h-4 w-4 text-primary" /> {balance.toFixed(6)} ALGO
                    </span>
                </div>
                 <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">Network Fee</span>
                    <span className="font-medium">{ALGO_NETWORK_FEE} ALGO</span>
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="recipient-address">
                Recipient Address
                </Label>
                <Input
                id="recipient-address"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="font-code"
                placeholder="Paste Algorand address here..."
                disabled={isLoading}
                />
            </div>
             <div className="space-y-2">
                <Label htmlFor="amount">
                Amount (ALGO)
                </Label>
                <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                disabled={isLoading}
                />
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={isLoading || !recipient || !amount}>
            {isLoading ? (
                <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    <span>Sending...</span>
                </>
            ) : (
                "Review & Send"
            )}
            
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
