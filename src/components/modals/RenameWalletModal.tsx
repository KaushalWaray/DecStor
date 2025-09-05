
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
import { LoaderCircle, Edit } from 'lucide-react';

interface RenameWalletModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (newName: string) => Promise<boolean>;
  currentName: string;
}

export default function RenameWalletModal({ isOpen, onOpenChange, onConfirm, currentName }: RenameWalletModalProps) {
  const [newName, setNewName] = useState(currentName || '');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleConfirm = async () => {
    if (!newName.trim()) {
      toast({ variant: 'destructive', title: 'Invalid Name', description: 'Wallet name cannot be empty.' });
      return;
    }
    if (newName === currentName) {
      onOpenChange(false);
      return;
    }
    setIsLoading(true);
    const success = await onConfirm(newName);
    setIsLoading(false);
    if (success) {
      onOpenChange(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setNewName(currentName || '');
    }
  }, [isOpen, currentName]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2"><Edit />Rename Wallet</DialogTitle>
          <DialogDescription>Enter a new name for your wallet.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 my-4">
            <div className="space-y-2">
                <Label htmlFor="wallet-name">
                    New Wallet Name
                </Label>
                <Input
                  id="wallet-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter new wallet name"
                  disabled={isLoading}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                />
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={isLoading || !newName.trim() || newName === currentName}>
            {isLoading ? (
                <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                </>
            ) : (
                "Save Name"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
