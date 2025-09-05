
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
import { LoaderCircle, FolderLock, Eye, EyeOff } from 'lucide-react';

interface UnlockFolderModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onUnlock: (pin: string) => void;
  folderName: string;
}

export default function UnlockFolderModal({ isOpen, onOpenChange, onUnlock, folderName }: UnlockFolderModalProps) {
  const [pin, setPin] = useState('');
  const [isPinVisible, setIsPinVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Can be used for async validation if needed
  const { toast } = useToast();

  const handleUnlock = () => {
    if (pin.length < 4) {
      toast({ variant: 'destructive', title: 'Invalid PIN', description: 'Please enter a valid PIN to unlock this folder.' });
      return;
    }
    // We don't validate the PIN here. We just pass it up.
    // Decryption failure of a file inside the folder will be the "validation".
    onUnlock(pin);
  };
  
  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleUnlock();
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setPin('');
      setIsPinVisible(false);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2"><FolderLock /> Unlock Folder</DialogTitle>
          <DialogDescription>
            The folder <span className="font-bold text-foreground">{folderName}</span> is locked. Enter its PIN to access its contents.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 my-4">
            <div className="space-y-2">
                <Label htmlFor="folder-pin">Folder PIN</Label>
                <div className="relative">
                <Input
                    id="folder-pin"
                    type={isPinVisible ? 'text' : 'password'}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Enter folder PIN"
                    disabled={isLoading}
                    autoFocus
                />
                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setIsPinVisible(!isPinVisible)}>
                    {isPinVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                </div>
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleUnlock} disabled={isLoading || pin.length < 4}>
            {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            Unlock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    
