
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { AlgorandAccount, FileMetadata } from '@/types';
import { Button } from '@/components/ui/button';
import { readInbox, ensureOptedIn } from '@/lib/algorand';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import FileGrid from './FileGrid';

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
      // First, ensure the user is opted-in to the contract.
      // This will create their on-chain "mailbox" if it doesn't exist.
      await ensureOptedIn(account);

      const inboxFiles = await readInbox(account.addr);
      setFiles(inboxFiles);

      if (!isInitialLoad) {
        toast({ title: "Inbox refreshed!", description: `Found ${inboxFiles.length} files.` });
      }

    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error Refreshing Inbox', description: error.message || 'Could not refresh your inbox.' });
    } finally {
      setIsLoading(false);
    }
  }, [account, toast]);

  // Fetch files on initial component load
  useEffect(() => {
    handleRefresh(true);
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
