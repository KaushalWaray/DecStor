
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
import { LoaderCircle, FolderPlus } from 'lucide-react';

interface CreateFolderModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (folderName: string) => Promise<void>;
}

export default function CreateFolderModal({ isOpen, onOpenChange, onConfirm }: CreateFolderModalProps) {
  const [folderName, setFolderName] = useState('');
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

    setIsLoading(true);
    await onConfirm(folderName);
    setIsLoading(false);
    onOpenChange(false); // Close modal on success
  };

  // Reset state when modal opens/closes
  useState(() => {
    if (!isOpen) {
        setFolderName('');
        setIsLoading(false);
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2"><FolderPlus />Create New Folder</DialogTitle>
          <DialogDescription>Enter a name for your new folder.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 my-4">
            <div className="space-y-2">
                <Label htmlFor="folder-name">
                Folder Name
                </Label>
                <Input
                id="folder-name"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="e.g. 'Work Documents'"
                disabled={isLoading}
                />
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={isLoading || !folderName}>
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
