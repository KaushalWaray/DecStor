
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { AlgorandAccount, FileMetadata, StorageInfo, FilesAndStorageInfo } from '@/types';
import { getFilesByOwner, confirmPayment } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import FileUploader from './FileUploader';
import FileGrid from './FileGrid';
import { LoaderCircle } from 'lucide-react';
import ShareFileModal from '../modals/ShareFileModal';
import { shareFile, payForStorageUpgrade } from '@/lib/algorand';
import { truncateAddress } from '@/lib/utils';
import { mnemonicToAccount } from '@/lib/algorand';
import { decryptMnemonic } from '@/lib/crypto';
import StorageManager from './StorageManager'; // Import the new component

interface MyVaultProps {
  account: AlgorandAccount;
  pin: string;
}

export default function MyVault({ account, pin }: MyVaultProps) {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [fileToShare, setFileToShare] = useState<FileMetadata | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);


  const { toast } = useToast();

  const fetchFilesAndStorage = useCallback(async () => {
    setIsLoading(true);
    try {
      // API now returns both files and storage info
      const response: FilesAndStorageInfo = await getFilesByOwner(account.addr);
      
      const vaultFiles = response.files.filter(f => f.owner === account.addr);
      setFiles(vaultFiles);
      setStorageInfo(response.storageInfo);

    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch your files and storage data.' });
    } finally {
      setIsLoading(false);
    }
  }, [account.addr, toast]);

  useEffect(() => {
    fetchFilesAndStorage();
  }, [fetchFilesAndStorage]);
  
  const handleOpenShareModal = (file: FileMetadata) => {
    setFileToShare(file);
    setIsShareModalOpen(true);
  };

  const handleConfirmShare = async (recipientAddress: string) => {
    if (!fileToShare) return;

    setIsSharing(true);
    try {
        const storedWallets = JSON.parse(localStorage.getItem('metadrive_wallets') || '[]');
        const walletEntry = storedWallets.find((w: any) => w.address === account.addr);
        if (!walletEntry) throw new Error("Could not find wallet credentials to sign transaction.");

        const mnemonic = await decryptMnemonic(walletEntry.encryptedMnemonic, pin);
        if (!mnemonic) throw new Error("Decryption failed");
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

  const handleUpgrade = async () => {
      setIsUpgrading(true);
      try {
        toast({ title: "Action Required", description: "Please approve the payment transaction in your wallet." });
        
        // We need the full account with private key to sign
        const storedWallets = JSON.parse(localStorage.getItem('metadrive_wallets') || '[]');
        const walletEntry = storedWallets.find((w: any) => w.address === account.addr);
        if (!walletEntry) throw new Error("Could not find wallet credentials to sign transaction.");

        const mnemonic = await decryptMnemonic(walletEntry.encryptedMnemonic, pin);
        if (!mnemonic) throw new Error("Decryption failed");
        const senderAccount = mnemonicToAccount(mnemonic);
        
        // 1. Send the payment transaction
        const { txId } = await payForStorageUpgrade(senderAccount);
        toast({ title: "Payment Sent!", description: "Waiting for network confirmation..." });

        // 2. Confirm payment with the backend
        const updatedStorageInfo = await confirmPayment(senderAccount.addr, txId);
        setStorageInfo(updatedStorageInfo);

        toast({ title: "Upgrade Complete!", description: "Your storage has been successfully upgraded." });

      } catch (error: any) {
          console.error("Upgrade failed:", error);
          toast({ variant: "destructive", title: "Upgrade Failed", description: error.message || "An unknown error occurred." });
      } finally {
          setIsUpgrading(false);
      }
  };
  
  return (
    <div className="space-y-6">
      <FileUploader ownerAddress={account.addr} onUploadSuccess={fetchFilesAndStorage} />
      
      {storageInfo && (
        <StorageManager 
            storageInfo={storageInfo}
            onUpgrade={handleUpgrade}
            isUpgrading={isUpgrading}
        />
      )}
      
      <div className="p-6 bg-card rounded-lg">
        <h2 className="text-2xl font-headline font-semibold mb-4">My Files</h2>
        {isLoading && files.length === 0 ? (
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
