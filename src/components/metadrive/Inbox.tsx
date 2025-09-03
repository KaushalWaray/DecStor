"use client";

import { useState, useEffect, useCallback } from 'react';
import type { AlgorandAccount, FileMetadata, FilesAndStorageInfo } from '@/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import FileGrid from './FileGrid';
import { getFilesByOwner } from '@/lib/api';

interface InboxProps {
  account: AlgorandAccount;
}

export default function Inbox({ account }: InboxProps) {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleRefresh = useCallback(async (isInitialLoad = false) => {
    setIsLoading(true);
    try {
      // The API now returns an object with `files` and `storageInfo`.
      // We need to unpack it.
      const response: FilesAndStorageInfo = await getFilesByOwner(account.addr);
      const allFiles = response.files;

      const inboxFiles = allFiles.filter(f => f.owner !== account.addr);
      setFiles(inboxFiles);

      if (!isInitialLoad) {
        toast({ title: "Inbox refreshed!", description: `Found ${inboxFiles.length} received files.` });
      }

    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error Refreshing Inbox', description: error.message || 'Could not refresh your inbox.' });
    } finally {
      setIsLoading(false);
    }
  }, [account.addr, toast]);

  // Fetch files on initial component load
  useEffect(() => {
    handleRefresh(true);
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.addr]);

  return (
    <div className="p-6 bg-card rounded-lg space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-headline font-semibold">Received Files</h2>
        <Button onClick={() => handleRefresh(false)} disabled={isLoading}>
          {isLoading ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh Inbox
        </Button>
      </div>
      {isLoading && files.length === 0 ? (
        <div className="flex justify-center items-center h-40">
          <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <FileGrid files={files} />
      )}
    </div>
  );
}
