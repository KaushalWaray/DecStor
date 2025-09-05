
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
import { LoaderCircle, FileText, Send } from 'lucide-react';
import { FileMetadata } from '@/types';

interface SendFileModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (recipient: string) => void;
  isLoading: boolean;
  file: FileMetadata;
}

export default function SendFileModal({ isOpen, onOpenChange, onConfirm, isLoading, file }: SendFileModalProps) {
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2"><Send/>Send File</DialogTitle>
          <DialogDescription>Enter the recipient's Algorand address to send this file.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 my-4">
            <div className="flex items-center gap-3 p-3 rounded-md bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <span className="font-medium truncate">{file.filename}</span>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={isLoading || !recipient}>
            {isLoading ? (
                <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    <span>Validating...</span>
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
