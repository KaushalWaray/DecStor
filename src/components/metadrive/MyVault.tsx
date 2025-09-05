
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AlgorandAccount, FileMetadata, StorageInfo, FilesAndStorageInfo, WalletEntry } from '@/types';
import { getFilesByOwner, confirmPayment, getStorageServiceAddress, deleteFileFromDb } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import FileUploader from './FileUploader';
import FileGrid from './FileGrid';
import { LoaderCircle, HardDrive, FileSearch, Search, AlertTriangle } from 'lucide-react';
import ShareFileModal from '../modals/ShareFileModal';
import FileDetailsModal from '../modals/FileDetailsModal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from '../ui/button';
import { Input } from '../ui/input';
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
  const [allFiles, setAllFiles] = useState<FileMetadata[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);

  const [isSharing, setIsSharing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // State for upgrading
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [storageServiceAddress, setStorageServiceAddress] = useState<string>('');

  const { toast } = useToast();

  const vaultFiles = useMemo(() => {
    return allFiles.filter(f => f.owner === account.addr);
  }, [allFiles, account.addr]);

  const filteredFiles = useMemo(() => {
    if (!searchTerm) return vaultFiles;
    return vaultFiles.filter(file => 
      file.filename.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [vaultFiles, searchTerm]);

  const fetchFilesAndStorage = useCallback(async () => {
    setIsLoading(true);
    try {
      const response: FilesAndStorageInfo = await getFilesByOwner(account.addr);
      setAllFiles(response.files);
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
    setSelectedFile(file);
    setIsShareModalOpen(true);
  };
  
  const handleOpenDetailsModal = (file: FileMetadata) => {
    setSelectedFile(file);
    setIsDetailsModalOpen(true);
  };
  
  const handleOpenDeleteModal = (file: FileMetadata) => {
    setSelectedFile(file);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmShare = async (recipientAddress: string) => {
    if (!selectedFile) return;
    setIsSharing(true);
    try {
        toast({ title: "Sharing File...", description: "Please approve the transaction to create an on-chain proof-of-share." });
        const storedWallets = JSON.parse(localStorage.getItem('metadrive_wallets') || '[]');
        const walletEntry = storedWallets.find((w: any) => w.address === account.addr);
        if (!walletEntry) throw new Error("Could not find wallet credentials to sign transaction.");

        const mnemonic = await decryptMnemonic(walletEntry.encryptedMnemonic, pin);
        if (!mnemonic) throw new Error("Decryption failed");
        const senderAccount = mnemonicToAccount(mnemonic);

      const {txId} = await shareFile(senderAccount, recipientAddress, selectedFile.cid);
      
      toast({
        title: 'File Shared!',
        description: `Successfully shared ${selectedFile.filename} with ${truncateAddress(recipientAddress)}. TxID: ${truncateAddress(txId, 6, 4)}`,
      });

    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Sharing Failed', description: error.message || 'Could not share the file.' });
    } finally {
      setIsSharing(false);
      setIsShareModalOpen(false);
      setSelectedFile(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedFile) return;
    setIsDeleting(true);
    try {
        // TODO: Also unpin from Pinata
        await deleteFileFromDb(selectedFile.cid, account.addr);
        toast({ title: "File Deleted", description: `${selectedFile.filename} has been removed from your vault.`});
        await fetchFilesAndStorage(); // Refresh data
    } catch(error: any) {
        console.error("Delete failed:", error);
        toast({ variant: "destructive", title: "Delete Failed", description: error.message || "An unknown error occurred." });
    } finally {
        setIsDeleting(false);
        setIsDeleteModalOpen(false);
        setSelectedFile(null);
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

  const getEmptyState = () => {
    if (searchTerm) {
        return { title: 'No Results Found', description: 'Your search did not match any files in your vault.', icon: FileSearch };
    }
    return { title: 'Your Vault is Empty', description: 'Upload a file to get started.', icon: HardDrive };
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
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-4">
            <h2 className="text-2xl font-headline font-semibold">My Files</h2>
            <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search my files..." 
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        {isLoading && filteredFiles.length === 0 && !searchTerm ? (
          <div className="flex justify-center items-center h-64">
            <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <FileGrid 
            files={filteredFiles} 
            account={account}
            onShare={handleOpenShareModal}
            onDetails={handleOpenDetailsModal}
            onDelete={handleOpenDeleteModal}
            emptyState={getEmptyState()}
          />
        )}
      </div>

      {selectedFile && (
        <>
            <ShareFileModal
            isOpen={isShareModalOpen}
            onOpenChange={setIsShareModalOpen}
            onConfirm={handleConfirmShare}
            isLoading={isSharing}
            filename={selectedFile.filename}
            />
            <FileDetailsModal
                isOpen={isDetailsModalOpen}
                onOpenChange={setIsDetailsModalOpen}
                file={selectedFile}
            />
            <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive" />Are you sure you want to delete this file?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete <span className="font-bold text-foreground">{selectedFile.filename}</span> from your vault. This action cannot be undone.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                        {isDeleting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                        Delete File
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
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
