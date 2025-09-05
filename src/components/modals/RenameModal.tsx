
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
import { LoaderCircle, Edit, FileText, Folder } from 'lucide-react';
import type { FileMetadata, Folder as FolderType } from '@/types';

interface RenameModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (newName: string) => Promise<void>;
  isLoading: boolean;
  item: FileMetadata | FolderType;
}

export default function RenameModal({ isOpen, onOpenChange, onConfirm, isLoading, item }: RenameModalProps) {
  const isFolder = 'path' in item;
  const currentName = isFolder ? item.name : item.filename;

  const [newName, setNewName] = useState(currentName);
  const { toast } = useToast();

  const handleConfirm = async () => {
    if (!newName.trim()) {
      toast({ variant: 'destructive', title: 'Invalid Name', description: 'Name cannot be empty.' });
      return;
    }
     if (newName.includes('/')) {
        toast({ variant: 'destructive', title: 'Invalid Name', description: 'Name cannot contain slashes.' });
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
      setNewName(isFolder ? item.name : item.filename);
    } else {
        // Reset after a delay to avoid UI flicker during closing animation
        setTimeout(() => {
            setNewName('');
        }, 200);
    }
  }, [isOpen, item, isFolder]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2"><Edit />Rename {isFolder ? 'Folder' : 'File'}</DialogTitle>
          <DialogDescription>Enter a new name for the item.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 my-4">
            <div className="flex items-center gap-3 p-3 rounded-md bg-muted">
                {isFolder ? <Folder className="h-5 w-5 text-amber-400 flex-shrink-0" /> : <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
                <span className="font-medium truncate">{currentName}</span>
            </div>
            <div className="space-y-2">
                <Label htmlFor="item-name">
                    New Name
                </Label>
                <Input
                id="item-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter new name"
                disabled={isLoading}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
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
