
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
import type { Folder as FolderType } from '@/types';

interface MoveFileModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (newPath: string) => Promise<void>;
  filename: string;
  folders: FolderType[];
  currentPath: string;
}

export default function MoveFileModal({ isOpen, onOpenChange, onConfirm, filename, folders, currentPath }: MoveFileModalProps) {
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

  // Filter out the current folder from the list of possible destinations
  const availableFolders = useMemo(() => {
    return [
      { name: 'My Vault (Root)', path: '/' },
      ...folders.map(f => ({ name: f.path + f.name, path: `${f.path}${f.name}/` }))
    ].filter(f => f.path !== currentPath);
  }, [folders, currentPath]);


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2"><ArrowRight />Move File</DialogTitle>
          <DialogDescription>Choose a new location for <span className="font-bold text-foreground">{filename}</span>.</DialogDescription>
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
                "Move File"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
