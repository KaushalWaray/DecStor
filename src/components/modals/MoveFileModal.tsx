
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle, FileText, Folder, ArrowRight } from 'lucide-react';
import type { Folder as FolderType } from '@/types';

interface MoveFileModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (newPath: string) => Promise<void>;
  isLoading: boolean;
  filename: string;
  folders: FolderType[];
  currentPath: string;
}

export default function MoveFileModal({ isOpen, onOpenChange, onConfirm, isLoading, filename, folders, currentPath }: MoveFileModalProps) {
  const [destinationPath, setDestinationPath] = useState('');
  const [isMoving, setIsMoving] = useState(false); // Local loading state
  const { toast } = useToast();

  const handleConfirm = async () => {
    if (!destinationPath) {
      toast({ variant: 'destructive', title: 'No Destination', description: 'Please select a destination folder.' });
      return;
    }
    setIsMoving(true);
    await onConfirm(destinationPath);
    setIsMoving(false);
    onOpenChange(false);
  };

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
        setDestinationPath('');
        setIsMoving(false);
    }
  }, [isOpen]);

  // Filter out the current folder from the list of possible destinations
  const availableFolders = [
    { name: 'My Vault (Root)', path: '/' },
    ...folders.map(f => ({ name: f.path + f.name, path: `${f.path}${f.name}/` }))
  ].filter(f => f.path !== currentPath);


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2"><ArrowRight />Move File</DialogTitle>
          <DialogDescription>Choose a new location for your file.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 my-4">
            <div className="flex items-center gap-3 p-3 rounded-md bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <span className="font-medium truncate">{filename}</span>
            </div>
            <div className="space-y-2">
                <Label htmlFor="destination-folder">Destination Folder</Label>
                 <Select value={destinationPath} onValueChange={setDestinationPath} disabled={isLoading || isMoving}>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading || isMoving}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={isLoading || isMoving || !destinationPath}>
            {isMoving ? (
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
