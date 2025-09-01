"use client";

import { useState, useCallback } from 'react';
import type { AlgorandAccount, FileMetadata } from '@/types';
import { Button } from '@/components/ui/button';
import { readInbox } from '@/lib/algorand';
import { getFilesByCids } from '@/lib/api';
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

  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const cids = await readInbox(account.addr);
      if (cids.length > 0) {
        const inboxFiles = await getFilesByCids(cids);
        setFiles(inboxFiles);
        toast({ title: "Inbox refreshed!", description: `Found ${inboxFiles.length} new file(s).` });
      } else {
        setFiles([]);
        toast({ title: "Inbox is up to date." });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not refresh your inbox.' });
    } finally {
      setIsLoading(false);
    }
  }, [account.addr, toast]);

  return (
    <div className="p-6 bg-card rounded-lg space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-headline font-semibold">Received Files</h2>
        <Button onClick={handleRefresh} disabled={isLoading}>
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
