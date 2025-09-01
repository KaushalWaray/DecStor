
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { AlgorandAccount, FileMetadata } from '@/types';
import { getFilesByOwner } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import FileUploader from './FileUploader';
import FileGrid from './FileGrid';
import { LoaderCircle } from 'lucide-react';
import ShareFileModal from '../modals/ShareFileModal';
import ApproveTransactionModal from '../modals/ApproveTransactionModal';
import { shareFile } from '@/lib/algorand';
import { ALGO_NETWORK_FEE } from '@/lib/constants';
import { truncateAddress } from '@/lib/utils';

interface MyVaultProps {
  account: AlgorandAccount;
  pin: string;
}

export default function MyVault({ account, pin }: MyVaultProps) {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [fileToShare, setFileToShare] = useState<FileMetadata | null>(null);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  const { toast } = useToast();

  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const ownerFiles = await getFilesByOwner(account.addr);
      setFiles(ownerFiles);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch your files.' });
    } finally {
      setIsLoading(false);
    }
  }, [account.addr, toast]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);
  
  const handleOpenShareModal = (file: FileMetadata) => {
    setFileToShare(file);
    setIsShareModalOpen(true);
  };
  
  const handlePrepareShare = (recipient: string) => {
    setRecipientAddress(recipient);
    setIsShareModalOpen(false);
    setIsApproveModalOpen(true);
  };

  const handleConfirmShare = async () => {
    if (!fileToShare || !recipientAddress) return;

    setIsSharing(true);
    try {
      const txId = await shareFile(account, recipientAddress, fileToShare.cid);
      
      const isSimulated = txId.startsWith('SIMULATED');
      if (isSimulated) {
        toast({
          title: 'Share Simulated!',
          description: `File sharing to ${truncateAddress(recipientAddress)} was simulated.`,
        });
      } else {
         toast({
          title: 'File Shared!',
          description: `Transaction ID: ${truncateAddress(txId, 10, 10)}`,
        });
      }

    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Sharing Failed', description: error.message || 'Could not send the file sharing transaction.' });
    } finally {
      setIsSharing(false);
      setIsApproveModalOpen(false);
      setFileToShare(null);
      setRecipientAddress('');
    }
  };
  
  return (
    <div className="space-y-6">
      <FileUploader ownerAddress={account.addr} onUploadSuccess={fetchFiles} />
      <div className="p-6 bg-card rounded-lg">
        <h2 className="text-2xl font-headline font-semibold mb-4">My Files</h2>
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <FileGrid files={files} onShare={handleOpenShareModal} />
        )}
      </div>

      {fileToShare && (
        <ShareFileModal
          isOpen={isShareModalOpen}
          onOpenChange={setIsShareModalOpen}
          onConfirm={handlePrepareShare}
        />
      )}

      {fileToShare && (
        <ApproveTransactionModal
          isOpen={isApproveModalOpen}
          onOpenChange={setIsApproveModalOpen}
          onApprove={handleConfirmShare}
          recipientAddress={recipientAddress}
          networkFee={ALGO_NETWORK_FEE}
          isLoading={isSharing}
        />
      )}
    </div>
  );
}
