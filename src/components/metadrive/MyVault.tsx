
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AlgorandAccount, FileMetadata, Folder, StorageInfo, WalletEntry } from '@/types';
import { getFilesByOwner, confirmPayment, getStorageServiceAddress, createFolder as apiCreateFolder, renameFolder as apiRenameFolder, renameFile as apiRenameFile, moveItems as apiMoveItems, deleteItems as apiDeleteItems } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import FileUploader from './FileUploader';
import FileGrid from './FileGrid';
import { LoaderCircle, HardDrive, FileSearch, Search, AlertTriangle, FolderPlus, List, LayoutGrid } from 'lucide-react';
import SendFileModal from '../modals/SendFileModal';
import FileDetailsModal from '../modals/FileDetailsModal';
import CreateFolderModal from '../modals/CreateFolderModal';
import MoveFileModal from '../modals/MoveFileModal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import ApproveTransactionModal from '../modals/ApproveTransactionModal';
import UnlockFolderModal from '../modals/UnlockFolderModal';
import { payForStorageUpgrade } from '@/lib/algorand';
import { truncateAddress } from '@/lib/utils';
import { mnemonicToAccount } from '@/lib/algorand';
import { decryptMnemonic } from '@/lib/crypto';
import StorageManager from './StorageManager';
import Breadcrumbs from './Breadcrumbs';
import { UPGRADE_COST_ALGOS } from '@/lib/constants';
import RenameModal from '../modals/RenameModal';
import BulkActionBar from './BulkActionBar';
import MediaPreviewModal from '../modals/MediaPreviewModal';


interface MyVaultProps {
  account: AlgorandAccount;
  pin: string;
  onConfirmSendFile: (file: FileMetadata, recipient: string) => Promise<boolean>;
}

export default function MyVault({ account, pin, onConfirmSendFile }: MyVaultProps) {
  const [allFiles, setAllFiles] = useState<FileMetadata[]>([]);
  const [allFolders, setAllFolders] = useState<Folder[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isGlobalSearch, setIsGlobalSearch] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');
  
  // State for locked folders
  const [unlockedPins, setUnlockedPins] = useState<Record<string, string>>({});
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [folderToUnlock, setFolderToUnlock] = useState<Folder | null>(null);

  // Modal states
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isMediaPreviewModalOpen, setIsMediaPreviewModalOpen] = useState(false);
  
  // Data for modals
  const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);
  const [itemToDelete, setItemToDelete] = useState<FileMetadata | Folder | null>(null);
  const [itemsToMove, setItemsToMove] = useState<(FileMetadata | Folder)[]>([]);
  const [itemToRename, setItemToRename] = useState<FileMetadata | Folder | null>(null);
  const [fileToPreview, setFileToPreview] = useState<FileMetadata | null>(null);


  // Loading states
  const [isSending, setIsSending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  // State for upgrading
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [storageServiceAddress, setStorageServiceAddress] = useState<string>('');

  // New state for multi-select and view
  const [selectedItems, setSelectedItems] = useState<(FileMetadata | Folder)[]>([]);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const { toast } = useToast();

  const currentFolderPin = useMemo(() => {
    return unlockedPins[currentPath] || pin;
  }, [unlockedPins, currentPath, pin]);


  const displayedItems = useMemo(() => {
    let files = allFiles;
    let folders = allFolders;

    if (isGlobalSearch) {
      files = files.filter(file => file.filename.toLowerCase().includes(searchTerm.toLowerCase()));
      folders = folders.filter(folder => folder.name.toLowerCase().includes(searchTerm.toLowerCase()));
    } else {
      files = files.filter(file => file.path === currentPath && file.filename.toLowerCase().includes(searchTerm.toLowerCase()));
      folders = folders.filter(folder => folder.path === currentPath && folder.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return { files, folders };
  }, [allFiles, allFolders, searchTerm, currentPath, isGlobalSearch]);

  const fetchFilesAndStorage = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getFilesByOwner(account.addr, '/', true);
      setAllFiles(response.files || []);
      setAllFolders(response.folders || []);
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

  useEffect(() => {
    if (searchTerm) {
        setIsGlobalSearch(true);
    } else {
        setIsGlobalSearch(false);
    }
  }, [searchTerm]);

  const handleSelectionChange = (item: FileMetadata | Folder, isSelected: boolean) => {
      setSelectedItems(prev => 
          isSelected ? [...prev, item] : prev.filter(i => i._id !== item._id)
      );
  };
  
  const handleOpenSendModal = (file: FileMetadata) => {
    setSelectedFile(file);
    setIsSendModalOpen(true);
  };
  
  const handleOpenDetailsModal = (file: FileMetadata) => {
    setSelectedFile(file);
    setIsDetailsModalOpen(true);
  };
  
  const handleOpenDeleteModal = (item: FileMetadata | Folder) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  const handleBulkDelete = () => {
    // This will be handled by a different modal/alert for bulk operations.
    setIsDeleteModalOpen(true);
  }
  
  const handleOpenMoveModal = async (items: (FileMetadata | Folder)[]) => {
    setItemsToMove(items);
    setIsMoveModalOpen(true);
  };

  const handleOpenRenameModal = (item: FileMetadata | Folder) => {
    setItemToRename(item);
    setIsRenameModalOpen(true);
  };

  const handleOpenPreviewModal = (file: FileMetadata) => {
    setFileToPreview(file);
    setIsMediaPreviewModalOpen(true);
  };

  const handleConfirmSend = async (recipientAddress: string) => {
    if (!selectedFile) return;
    setIsSending(true);
    const success = await onConfirmSendFile(selectedFile, recipientAddress);
    setIsSending(false);
    if (success) {
      setIsSendModalOpen(false);
      setSelectedFile(null);
    }
  };

  const handleConfirmDelete = async () => {
    const itemsToDelete = itemToDelete ? [itemToDelete] : selectedItems;
    if (itemsToDelete.length === 0) return;
    
    setIsDeleting(true);
    try {
        const itemIds = itemsToDelete.map(i => i._id);
        await apiDeleteItems(account.addr, itemIds);
        
        toast({ title: "Items Deleted", description: `${itemsToDelete.length} item(s) have been removed from your vault.`});
        await fetchFilesAndStorage(); // Refresh data
        setSelectedItems([]);
    } catch(error: any) {
        console.error("Delete failed:", error);
        toast({ variant: "destructive", title: "Delete Failed", description: error.message || "An unknown error occurred." });
    } finally {
        setIsDeleting(false);
        setIsDeleteModalOpen(false);
        setItemToDelete(null);
    }
  };

  const handleConfirmMove = async (newPath: string) => {
    if (itemsToMove.length === 0) return;
    setIsMoving(true);
    try {
        const itemIds = itemsToMove.map(i => i._id);
        const itemTypes = itemsToMove.map(i => 'cid' in i ? 'file' : 'folder');
        await apiMoveItems(account.addr, itemIds, itemTypes, newPath);

        toast({ title: 'Items Moved', description: `${itemsToMove.length} item(s) have been moved successfully.`});
        await fetchFilesAndStorage(); // Refresh the view
        setSelectedItems([]);
    } catch (error: any) {
        console.error("Move failed:", error);
        toast({ variant: "destructive", title: "Move Failed", description: error.message || "An unknown error occurred." });
    } finally {
        setIsMoving(false);
        setIsMoveModalOpen(false);
        setItemsToMove([]);
    }
  };

  const handleConfirmRename = async (newName: string) => {
    if (!itemToRename) return;
    setIsMoving(true); // Re-use loading state for simplicity
    
    const isFolder = !('cid' in itemToRename);

    try {
        if (isFolder) {
            await apiRenameFolder(itemToRename._id, account.addr, newName);
        } else {
            await apiRenameFile(itemToRename._id, account.addr, newName);
        }
        toast({ title: 'Rename Successful', description: `Successfully renamed to '${newName}'.` });
        await fetchFilesAndStorage();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Rename Failed', description: error.message });
    } finally {
        setIsMoving(false);
        setIsRenameModalOpen(false);
        setItemToRename(null);
    }
  };


  const handleFolderClick = (folder: Folder) => {
    // If global search is active, clicking a folder clears the search and navigates
    if (isGlobalSearch) {
        setSearchTerm('');
    }

    const nextPath = `${folder.path}${folder.name}/`;
    if (folder.isLocked && !unlockedPins[nextPath]) {
        setFolderToUnlock(folder);
        setIsUnlockModalOpen(true);
    } else {
        setCurrentPath(nextPath);
    }
  };

  const handlePathChange = (newPath: string) => {
      // When changing path, clear search to avoid confusion
      setSearchTerm('');
      setCurrentPath(newPath);
  }

  const handleUnlockFolder = (folderPin: string) => {
    if (folderToUnlock) {
      const folderPath = `${folderToUnlock.path}${folderToUnlock.name}/`;
      setUnlockedPins(prev => ({ ...prev, [folderPath]: folderPin }));
      setCurrentPath(folderPath);
      toast({ title: "Folder Unlocked", description: `You can now access '${folderToUnlock.name}'.`});
    }
    setIsUnlockModalOpen(false);
    setFolderToUnlock(null);
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

  const handleCreateFolder = async (folderName: string, isLocked: boolean, folderPin?: string) => {
    try {
        await apiCreateFolder({ name: folderName, owner: account.addr, path: currentPath, isLocked });
        toast({ title: 'Folder Created', description: `Successfully created folder '${folderName}'.`});
        if(isLocked && folderPin) {
            const newPath = `${currentPath}${folderName}/`;
            setUnlockedPins(prev => ({...prev, [newPath]: folderPin}));
        }
        await fetchFilesAndStorage();
    } catch(error: any) {
        toast({ variant: 'destructive', title: 'Failed to Create Folder', description: error.message });
    }
  };

  const getEmptyState = () => {
    if (searchTerm) {
        return { title: 'No Results Found', description: 'Your search did not match any files or folders.', icon: FileSearch };
    }
    return { title: 'This Folder is Empty', description: 'Upload a file or create a folder to get started.', icon: HardDrive };
  };
  
  return (
    <div className="space-y-6">
      <FileUploader 
        ownerAddress={account.addr} 
        pin={currentFolderPin} 
        onUploadSuccess={fetchFilesAndStorage} 
        currentPath={currentPath}
      />
      
      {storageInfo && (
        <StorageManager 
            storageInfo={storageInfo}
            onUpgrade={handleInitiateUpgrade}
            isUpgrading={isUpgrading}
        />
      )}
      
      <div className="p-6 bg-card rounded-lg relative">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-4">
            <Breadcrumbs path={currentPath} onPathChange={handlePathChange} />
            <div className="flex w-full sm:w-auto gap-2">
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search vault..." 
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                 <Button variant="outline" size="icon" onClick={() => setView(v => v === 'grid' ? 'list' : 'grid')} title={view === 'grid' ? 'Switch to List View' : 'Switch to Grid View'}>
                    {view === 'grid' ? <List /> : <LayoutGrid />}
                </Button>
                <Button onClick={() => setIsCreateFolderModalOpen(true)}>
                    <FolderPlus className="mr-2 h-4 w-4" /> Create Folder
                </Button>
            </div>
        </div>

        {isLoading && displayedItems.files.length === 0 && displayedItems.folders.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <FileGrid 
            files={displayedItems.files}
            folders={displayedItems.folders}
            account={account}
            pin={currentFolderPin}
            onSend={handleOpenSendModal}
            onDetails={handleOpenDetailsModal}
            onDelete={handleOpenDeleteModal}
            onMove={handleOpenMoveModal}
            onRename={handleOpenRenameModal}
            onFolderClick={handleFolderClick}
            onPreview={handleOpenPreviewModal}
            emptyState={getEmptyState()}
            view={isGlobalSearch ? 'list' : view}
            selectedItems={selectedItems}
            onSelectionChange={handleSelectionChange}
          />
        )}
      </div>

      <BulkActionBar 
        selectedItemCount={selectedItems.length}
        onMove={() => handleOpenMoveModal(selectedItems)}
        onDelete={handleBulkDelete}
        onClear={() => setSelectedItems([])}
      />

      {selectedFile && (
        <>
            <SendFileModal
            isOpen={isSendModalOpen}
            onOpenChange={setIsSendModalOpen}
            onConfirm={handleConfirmSend}
            isLoading={isSending}
            file={selectedFile}
            />
            <FileDetailsModal
                isOpen={isDetailsModalOpen}
                onOpenChange={setIsDetailsModalOpen}
                file={selectedFile}
            />
        </>
      )}

      {fileToPreview && (
        <MediaPreviewModal
          isOpen={isMediaPreviewModalOpen}
          onOpenChange={setIsMediaPreviewModalOpen}
          file={fileToPreview}
          pin={currentFolderPin}
        />
      )}

       {itemToDelete && !selectedItems.length && (
            <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive" />Are you sure you want to delete this?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete <span className="font-bold text-foreground">{'cid' in itemToDelete ? itemToDelete.filename : itemToDelete.name}</span>. If it's a folder, all its contents will also be deleted. This action cannot be undone.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                        {isDeleting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                        Delete
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}

        {selectedItems.length > 0 && (
             <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive" />Delete {selectedItems.length} items?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete the {selectedItems.length} selected items? Any folders and their contents will be permanently deleted. This action cannot be undone.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                        {isDeleting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                        Delete
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}
      
      {itemsToMove.length > 0 && (
          <MoveFileModal
                isOpen={isMoveModalOpen}
                onOpenChange={setIsMoveModalOpen}
                onConfirm={handleConfirmMove}
                isLoading={isMoving}
                itemsToMove={itemsToMove}
                allFolders={allFolders}
             />
      )}

      {itemToRename && (
         <RenameModal
            isOpen={isRenameModalOpen}
            onOpenChange={setIsRenameModalOpen}
            onConfirm={handleConfirmRename}
            isLoading={isMoving} // reuse loading state
            item={itemToRename}
        />
      )}
      
      {folderToUnlock && (
          <UnlockFolderModal
            isOpen={isUnlockModalOpen}
            onOpenChange={setIsUnlockModalOpen}
            onUnlock={handleUnlockFolder}
            folderName={folderToUnlock.name}
          />
      )}

      <CreateFolderModal 
        isOpen={isCreateFolderModalOpen}
        onOpenChange={setIsCreateFolderModalOpen}
        onConfirm={handleCreateFolder}
      />

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

    
