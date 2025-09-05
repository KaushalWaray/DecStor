
"use client";

import { useState, useEffect } from 'react';
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
import { LoaderCircle, BookUser } from 'lucide-react';
import type { Contact } from '@/types';
import algosdk from 'algosdk';

interface EditContactModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (name: string, address: string) => Promise<boolean>;
  contact: Contact | null;
}

export default function EditContactModal({ isOpen, onOpenChange, onConfirm, contact }: EditContactModalProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setName(contact?.name || '');
      setAddress(contact?.address || '');
    }
  }, [isOpen, contact]);

  const handleConfirm = async () => {
    if (!name.trim() || !address.trim()) {
      toast({ variant: 'destructive', title: 'Missing Information', description: 'Please provide both a name and an address.' });
      return;
    }
    if (!algosdk.isValidAddress(address)) {
        toast({ variant: 'destructive', title: 'Invalid Address', description: 'The Algorand address is not valid.' });
        return;
    }

    setIsLoading(true);
    const success = await onConfirm(name, address);
    setIsLoading(false);
    
    if (success) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2"><BookUser /> {contact ? 'Edit Contact' : 'Add New Contact'}</DialogTitle>
          <DialogDescription>
            Enter a name and an Algorand address for your contact.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 my-4">
            <div className="space-y-2">
                <Label htmlFor="contact-name">Name</Label>
                <Input
                  id="contact-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., 'Alice's Wallet'"
                  disabled={isLoading}
                />
            </div>
             <div className="space-y-2">
                <Label htmlFor="contact-address">Algorand Address</Label>
                <Input
                  id="contact-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Paste address here"
                  className="font-code"
                  disabled={isLoading}
                />
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={isLoading || !name || !address}>
            {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : 'Save Contact'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
