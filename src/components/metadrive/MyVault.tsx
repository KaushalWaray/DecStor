
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { AlgorandAccount, FileMetadata } from '@/types';
import { getFilesByOwner } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import FileUploader from './FileUploader';
import FileGrid from './FileGrid';
import { LoaderCircle } from 'lucide-react';
import ShareFileModal from '../modals/ShareFileModal';
import { shareFile } from '@/lib/algorand';
import { truncateAddress } from '@/lib/utils';
import { mnemonicToAccount } from '@/lib/algorand';
import { decryptMnemonic } from '@/lib/crypto';

interface MyVaultProps {
  account: AlgorandAccount;
  pin: string;
}

export default function MyVault({ account, pin }: MyVaultProps) {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [fileToShare, setFileToShare] = useState<FileMetadata | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const { toast } = useToast();

  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      // Vault files are files owned by the current user
      const allFiles = await getFilesByOwner(account.addr);
      const vaultFiles = allFiles.filter(f => f.owner === account.addr);
      setFiles(vaultFiles);
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

  const handleConfirmShare = async (recipientAddress: string) => {
    if (!fileToShare) return;

    setIsSharing(true);
    try {
        // We need the full sender account with private key to sign the transaction.
        // We can reconstruct it from the encrypted mnemonic and PIN.
        const storedWallets = JSON.parse(localStorage.getItem('metadrive_wallets') || '[]');
        const walletEntry = storedWallets.find((w: any) => w.address === account.addr);
        if (!walletEntry) throw new Error("Could not find wallet credentials to sign transaction.");

        const mnemonic = await decryptMnemonic(walletEntry.encryptedMnemonic, pin);
        const senderAccount = mnemonicToAccount(mnemonic);

      await shareFile(senderAccount, recipientAddress, fileToShare.cid);
      
      toast({
        title: 'File Shared!',
        description: `Successfully shared ${fileToShare.filename} with ${truncateAddress(recipientAddress)}.`,
      });

    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Sharing Failed', description: error.message || 'Could not share the file.' });
    } finally {
      setIsSharing(false);
      setIsShareModalOpen(false);
      setFileToShare(null);
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
          onConfirm={handleConfirmShare}
          isLoading={isSharing}
        />
      )}
    </div>
  );
}
