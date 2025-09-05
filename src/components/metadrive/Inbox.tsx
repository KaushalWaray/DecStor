
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AlgorandAccount, FileMetadata, Folder } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle, RefreshCw, Inbox as InboxIcon, FileSearch, Search } from 'lucide-react';
import FileGrid from './FileGrid';
import { getFilesByOwner } from '@/lib/api';

interface InboxProps {
  account: AlgorandAccount;
  pin: string;
}

export default function Inbox({ account, pin }: InboxProps) {
  const [allFiles, setAllFiles] = useState<FileMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  // The inbox will show all files shared with the user, regardless of folder structure for now.
  const inboxFiles = useMemo(() => {
      const allSharedFiles = allFiles.filter(f => f.owner !== account.addr);
      const uniqueCids = new Set();
      return allSharedFiles.filter(file => {
          if(uniqueCids.has(file.cid)) {
              return false;
          }
          uniqueCids.add(file.cid);
          return true;
      })
  }, [allFiles, account.addr]);

  const filteredFiles = useMemo(() => {
    return inboxFiles.filter(file => 
      file.filename.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [inboxFiles, searchTerm]);

  const handleRefresh = useCallback(async (isInitialLoad = false) => {
    setIsLoading(true);
    try {
      // We still fetch with a path, but the backend is now configured to return all shared files
      const response = await getFilesByOwner(account.addr, '/');
      setAllFiles(response.sharedFiles || []);

      if (!isInitialLoad) {
        toast({ title: "Inbox refreshed!", description: `Found ${response.sharedFiles?.length || 0} received files.` });
      }

    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error Refreshing Inbox', description: error.message || 'Could not refresh your inbox.' });
    } finally {
      setIsLoading(false);
    }
  }, [account.addr, toast]);

  useEffect(() => {
    handleRefresh(true);
  }, [handleRefresh]);


  const getEmptyState = () => {
    if (searchTerm) {
        return { title: 'No Results Found', description: 'Your search did not match any files in your inbox.', icon: FileSearch };
    }
    return { title: 'Your Inbox is Empty', description: 'Files shared with you by other users will appear here.', icon: InboxIcon };
  };

  // Inbox doesn't have actions like share/delete/details for now.
  const noOp = () => {};

  return (
    <div className="p-6 bg-card rounded-lg space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <h2 className="text-2xl font-headline font-semibold">Received Files</h2>
        <div className="flex w-full sm:w-auto gap-2">
            <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search received files..." 
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
          <Button onClick={() => handleRefresh(false)} disabled={isLoading} className="flex-shrink-0">
            {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>
      {isLoading && filteredFiles.length === 0 ? (
        <div className="flex justify-center items-center h-64">
          <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <FileGrid 
            files={filteredFiles}
            folders={[]} // Inbox doesn't show folders
            account={account}
            pin={pin}
            onShare={noOp}
            onDetails={noOp}
            onDelete={noOp}
            onMove={noOp}
            onFolderClick={noOp}
            emptyState={getEmptyState()}
        />
      )}
    </div>
  );
}
