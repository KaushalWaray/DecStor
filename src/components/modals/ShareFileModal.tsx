
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
import { LoaderCircle } from 'lucide-react';

interface ShareFileModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (recipient: string) => void;
  isLoading: boolean;
}

export default function ShareFileModal({ isOpen, onOpenChange, onConfirm, isLoading }: ShareFileModalProps) {
  const [recipient, setRecipient] = useState('');
  const { toast } = useToast();

  const handleConfirm = () => {
    if (!algosdk.isValidAddress(recipient)) {
      toast({ variant: 'destructive', title: 'Invalid Address', description: 'Please enter a valid Algorand address.' });
      return;
    }
    onConfirm(recipient);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">Share File</DialogTitle>
          <DialogDescription>Enter the recipient's Algorand address to share this file.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="recipient-address" className="text-right">
              Recipient
            </Label>
            <Input
              id="recipient-address"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="col-span-3 font-code"
              placeholder="ALGO Address..."
              disabled={isLoading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Share
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
