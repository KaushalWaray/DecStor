
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
  isLoading: boolean;
  itemsToMove: (FileMetadata | FolderType)[];
  allFolders: FolderType[];
}

export default function MoveFileModal({ isOpen, onOpenChange, onConfirm, isLoading, itemsToMove, allFolders }: MoveFileModalProps) {
  const [destinationPath, setDestinationPath] = useState<string | undefined>(undefined);
  const { toast } = useToast();

  const handleConfirm = async () => {
    if (destinationPath === undefined || destinationPath === null) {
      toast({ variant: 'destructive', title: 'No Destination', description: 'Please select a destination folder.' });
      return;
    }
    await onConfirm(destinationPath);
    onOpenChange(false);
  };

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
        setDestinationPath(undefined);
    }
  }, [isOpen]);

  const availableFolders = useMemo(() => {
    // Paths of the folders being moved, e.g., ["/Work/", "/Personal/Photos/"]
    const movingFolderPaths = itemsToMove
        .filter((item): item is FolderType => !('cid' in item))
        .map(folder => `${folder.path}${folder.name}/`);

    // Paths of the parent folders of files being moved. We can't move a file to its current location.
    const currentFilePaths = itemsToMove
        .filter((item): item is FileMetadata => 'cid' in item)
        .map(file => file.path);
        
    const allPossibleFolders = [
      { name: 'My Vault (Root)', path: '/' },
      ...allFolders.map(f => ({ name: f.path + f.name, path: `${f.path}${f.name}/` }))
    ];

    return allPossibleFolders.filter(destFolder => {
        // Can't move a folder into itself or one of its own children.
        if (movingFolderPaths.some(movingPath => destFolder.path.startsWith(movingPath))) {
            return false;
        }

        // If we are ONLY moving files (no folders), we can't move them to their current directory.
        if (movingFolderPaths.length === 0 && itemsToMove.length > 0) {
            if (currentFilePaths.every(path => path === destFolder.path)) {
                return false;
            }
        }
        
        return true;
    });
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
