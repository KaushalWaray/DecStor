
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle, FileText, Folder, ArrowRight } from 'lucide-react';
import type { FileMetadata, Folder as FolderType } from '@/types';

interface MoveFileModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (newPath: string) => Promise<void>;
  itemsToMove: (FileMetadata | FolderType)[];
  allFolders: FolderType[];
}

export default function MoveFileModal({ isOpen, onOpenChange, onConfirm, itemsToMove, allFolders }: MoveFileModalProps) {
  const [destinationPath, setDestinationPath] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleConfirm = async () => {
    if (destinationPath === undefined || destinationPath === null) {
      toast({ variant: 'destructive', title: 'No Destination', description: 'Please select a destination folder.' });
      return;
    }
    setIsLoading(true);
    await onConfirm(destinationPath);
    setIsLoading(false);
    onOpenChange(false);
  };

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
        setDestinationPath(undefined);
        setIsLoading(false);
    }
  }, [isOpen]);

  const availableFolders = useMemo(() => {
    // Paths of the folders being moved
    const movingFolderPaths = itemsToMove
        .filter(item => !('cid' in item))
        .map(folder => `${folder.path}${folder.name}/`);

    // We can't move items to themselves or their own subfolders.
    const isInvalidDestination = (destFolder: {name: string, path: string}) => {
        // Can't move to a folder that is currently selected for moving.
        if (itemsToMove.some(item => !('cid' in item) && `${item.path}${item.name}/` === destFolder.path)) {
            return true;
        }
        // Can't move a folder into its own subfolder.
        if (movingFolderPaths.some(movingPath => destFolder.path.startsWith(movingPath))) {
            return true;
        }
        return false;
    }

    const allPossibleFolders = [
      { name: 'My Vault (Root)', path: '/' },
      ...allFolders.map(f => ({ name: f.path + f.name, path: `${f.path}${f.name}/` }))
    ];

    return allPossibleFolders.filter(f => !isInvalidDestination(f));
  }, [allFolders, itemsToMove]);

  if (!itemsToMove.length) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2"><ArrowRight />Move Items</DialogTitle>
          <DialogDescription>Choose a new location for the {itemsToMove.length} selected item(s).</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 my-4">
            <div className="space-y-2">
                <Label htmlFor="destination-folder">Destination Folder</Label>
                 <Select value={destinationPath} onValueChange={setDestinationPath} disabled={isLoading}>
                    <SelectTrigger id="destination-folder">
                        <SelectValue placeholder="Select a destination..." />
                    </SelectTrigger>
                    <SelectContent>
                        {availableFolders.map((folder) => (
                            <SelectItem key={folder.path} value={folder.path}>
                                <div className="flex items-center gap-2">
                                    <Folder className="h-4 w-4 text-amber-400"/>
                                    {folder.name}
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={isLoading || destinationPath === undefined}>
            {isLoading ? (
                <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    <span>Moving...</span>
                </>
            ) : (
                "Move"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
