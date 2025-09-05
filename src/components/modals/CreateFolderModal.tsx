
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
import { LoaderCircle, FolderPlus, Lock, Eye, EyeOff } from 'lucide-react';
import { Switch } from '../ui/switch';

interface CreateFolderModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (folderName: string, isLocked: boolean, pin?: string) => Promise<void>;
}

export default function CreateFolderModal({ isOpen, onOpenChange, onConfirm }: CreateFolderModalProps) {
  const [folderName, setFolderName] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isPinVisible, setIsPinVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleConfirm = async () => {
    if (!folderName.trim()) {
      toast({ variant: 'destructive', title: 'Invalid Name', description: 'Folder name cannot be empty.' });
      return;
    }
    if (folderName.includes('/')) {
        toast({ variant: 'destructive', title: 'Invalid Name', description: 'Folder name cannot contain slashes.' });
        return;
    }
    if (isLocked) {
        if(pin.length < 4) {
            toast({ variant: 'destructive', title: 'Invalid PIN', description: 'Folder PIN must be at least 4 digits.' });
            return;
        }
        if(pin !== confirmPin) {
            toast({ variant: 'destructive', title: 'PINs Do Not Match', description: 'Please ensure both PINs are the same.' });
            return;
        }
    }

    setIsLoading(true);
    await onConfirm(folderName, isLocked, isLocked ? pin : undefined);
    setIsLoading(false);
    onOpenChange(false); // Close modal on success
  };

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
        setFolderName('');
        setIsLocked(false);
        setPin('');
        setConfirmPin('');
        setIsLoading(false);
    }
  }, [isOpen]);

  const canSubmit = folderName.trim() && (!isLocked || (pin && pin === confirmPin));

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2"><FolderPlus />Create New Folder</DialogTitle>
          <DialogDescription>Enter a name for your new folder. You can optionally lock it with a PIN.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 my-4">
            <div className="space-y-2">
                <Label htmlFor="folder-name">Folder Name</Label>
                <Input
                  id="folder-name"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="e.g. 'Work Documents'"
                  disabled={isLoading}
                />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                    <Label className="flex items-center gap-2"><Lock />Lock this folder with a PIN</Label>
                    <p className="text-xs text-muted-foreground">Requires a PIN to view or modify contents.</p>
                </div>
                <Switch
                    checked={isLocked}
                    onCheckedChange={setIsLocked}
                    disabled={isLoading}
                />
            </div>
            {isLocked && (
                <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                        <Label htmlFor="pin">Folder PIN (4+ digits)</Label>
                        <div className="relative">
                        <Input id="pin" type={isPinVisible ? 'text' : 'password'} value={pin} onChange={(e) => setPin(e.target.value)} />
                        <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setIsPinVisible(!isPinVisible)}>
                            {isPinVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirm-pin">Confirm PIN</Label>
                        <Input id="confirm-pin" type={isPinVisible ? 'text' : 'password'} value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} />
                    </div>
                     <p className="text-xs text-destructive text-center p-2 bg-destructive/10 rounded-md">Warning: If you forget this PIN, the folder's contents will be unrecoverable.</p>
                </div>
            )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={isLoading || !canSubmit}>
            {isLoading ? (
                <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    <span>Creating...</span>
                </>
            ) : (
                "Create Folder"
            )}
            
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    
