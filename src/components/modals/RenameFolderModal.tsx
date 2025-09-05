
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

interface RenameFolderModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (newName: string) => Promise<void>;
  isLoading: boolean;
  currentName: string;
}

export default function RenameFolderModal({ isOpen, onOpenChange, onConfirm, isLoading, currentName }: RenameFolderModalProps) {
  const [newName, setNewName] = useState('');
  const { toast } = useToast();

  const handleConfirm = async () => {
    if (!newName.trim()) {
      toast({ variant: 'destructive', title: 'Invalid Name', description: 'Folder name cannot be empty.' });
      return;
    }
     if (newName.includes('/')) {
        toast({ variant: 'destructive', title: 'Invalid Name', description: 'Folder name cannot contain slashes.' });
        return;
    }
    if (newName === currentName) {
      onOpenChange(false);
      return;
    }
    await onConfirm(newName);
  };

  useEffect(() => {
    if (isOpen) {
      setNewName(currentName);
    } else {
        setTimeout(() => {
            setNewName('');
        }, 200);
    }
  }, [isOpen, currentName]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2"><Edit />Rename Folder</DialogTitle>
          <DialogDescription>Enter a new name for the folder.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 my-4">
            <div className="space-y-2">
                <Label htmlFor="folder-name">
                Folder Name
                </Label>
                <Input
                id="folder-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter new name"
                disabled={isLoading}
                />
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={isLoading || !newName}>
            {isLoading ? (
                <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                </>
            ) : (
                "Rename"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
