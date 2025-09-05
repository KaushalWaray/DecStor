
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { AlgorandAccount, FileMetadata, StorageInfo, FilesAndStorageInfo, WalletEntry } from '@/types';
import { getFilesByOwner, confirmPayment, getStorageServiceAddress } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import FileUploader from './FileUploader';
import FileGrid from './FileGrid';
import { LoaderCircle } from 'lucide-react';
import ShareFileModal from '../modals/ShareFileModal';
import ApproveTransactionModal from '../modals/ApproveTransactionModal';
import { shareFile, payForStorageUpgrade } from '@/lib/algorand';
import { truncateAddress } from '@/lib/utils';
import { mnemonicToAccount } from '@/lib/algorand';
import { decryptMnemonic } from '@/lib/crypto';
import StorageManager from './StorageManager';
import { UPGRADE_COST_ALGOS } from '@/lib/constants';


interface MyVaultProps {
  account: AlgorandAccount;
  pin: string;
}

export default function MyVault({ account, pin }: MyVaultProps) {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // State for sharing
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [fileToShare, setFileToShare] = useState<FileMetadata | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  // State for upgrading
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [storageServiceAddress, setStorageServiceAddress] = useState<string>('');


  const { toast } = useToast();

  const fetchFilesAndStorage = useCallback(async () => {
    setIsLoading(true);
    try {
      const response: FilesAndStorageInfo = await getFilesByOwner(account.addr);
      
      const vaultFiles = response.files.filter(f => f.owner === account.addr);
      setFiles(vaultFiles);
      setStorageInfo(response.storageInfo);

    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not fetch your files and storage data.' });
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
        toast({ title: "Sharing File...", description: "Please approve the transaction to create an on-chain proof-of-share." });
        const storedWallets = JSON.parse(localStorage.getItem('metadrive_wallets') || '[]');
        const walletEntry = storedWallets.find((w: any) => w.address === account.addr);
        if (!walletEntry) throw new Error("Could not find wallet credentials to sign transaction.");

        const mnemonic = await decryptMnemonic(walletEntry.encryptedMnemonic, pin);
        if (!mnemonic) throw new Error("Decryption failed");
        const senderAccount = mnemonicToAccount(mnemonic);

      const {txId} = await shareFile(senderAccount, recipientAddress, fileToShare.cid);
      
      toast({
        title: 'File Shared!',
        description: `Successfully shared ${fileToShare.filename} with ${truncateAddress(recipientAddress)}. TxID: ${truncateAddress(txId, 6, 4)}`,
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

  const handleInitiateUpgrade = async () => {
    try {
        const { address } = await getStorageServiceAddress();
        if (!address) {
            throw new Error("Could not retrieve a valid storage service address from the backend.");
        }
        setStorageServiceAddress(address);
        setIsUpgradeModalOpen(true);
    } catch(error: any) {
        toast({ variant: "destructive", title: "Cannot Start Upgrade", description: error.message });
    }
  };

  const handleConfirmUpgrade = async () => {
      setIsUpgrading(true);
      try {
        toast({ title: "Processing Upgrade...", description: "Please approve the transaction in your wallet." });
        
        const storedWallets: WalletEntry[] = JSON.parse(localStorage.getItem('metadrive_wallets') || '[]');
        const walletEntry = storedWallets.find(w => w.address === account.addr);
        
        if (!walletEntry) {
          throw new Error("Could not find wallet credentials. Please try re-importing your wallet.");
        }

        const mnemonic = await decryptMnemonic(walletEntry.encryptedMnemonic, pin);
        if (!mnemonic) {
          throw new Error("Decryption failed. Please check your PIN and try again.");
        }
        
        const senderAccount = mnemonicToAccount(mnemonic);
        
        const { txId } = await payForStorageUpgrade(senderAccount, storageServiceAddress);
        toast({ title: "Payment Sent!", description: `Transaction ${truncateAddress(txId, 6, 4)} confirmed. Finalizing upgrade...` });

        const updatedStorageInfo = await confirmPayment(senderAccount.addr, txId);
        setStorageInfo(updatedStorageInfo);

        toast({ title: "Upgrade Complete!", description: "Your storage has been successfully upgraded to 100MB." });

      } catch (error: any) {
          console.error("Upgrade failed:", error);
          toast({ variant: "destructive", title: "Upgrade Failed", description: error.message || "An unknown error occurred." });
      } finally {
          setIsUpgrading(false);
          setIsUpgradeModalOpen(false);
      }
  };
  
  return (
    <div className="space-y-6">
      <FileUploader ownerAddress={account.addr} onUploadSuccess={fetchFilesAndStorage} />
      
      {storageInfo && (
        <StorageManager 
            storageInfo={storageInfo}
            onUpgrade={handleInitiateUpgrade}
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
          filename={fileToShare.filename}
        />
      )}

      <ApproveTransactionModal
        isOpen={isUpgradeModalOpen}
        onOpenChange={setIsUpgradeModalOpen}
        onApprove={handleConfirmUpgrade}
        isLoading={isUpgrading}
        title="Approve Storage Upgrade"
        description="You are about to pay for a storage upgrade. Review the details below."
        actionText="Upgrade to 100MB Pro Tier"
        recipientAddress={storageServiceAddress}
        amount={UPGRADE_COST_ALGOS}
      />
    </div>
  );
}
