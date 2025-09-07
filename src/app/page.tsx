
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { AlgorandAccount, WalletState, WalletEntry, FileMetadata, User } from '@/types';
import { encryptMnemonic, decryptMnemonic } from '@/lib/crypto';
import { mnemonicToAccount, isValidMnemonic, sendPayment, sendFile } from '@/lib/algorand';
import { useToast } from '@/hooks/use-toast';
import { truncateAddress } from '@/lib/utils';
import { findOrCreateUserInDb, confirmPayment, renameWallet as apiRenameWallet } from '@/lib/api';

import WelcomeScreen from '@/components/metadrive/WelcomeScreen';
import CreateWalletFlow from '@/components/metadrive/CreateWalletFlow';
import ImportWalletScreen from '@/components/metadrive/ImportWalletScreen';
import LockScreen from '@/components/metadrive/LockScreen';
import Dashboard from '@/components/metadrive/Dashboard';
import { LoaderCircle } from 'lucide-react';

export default function Home() {
  const [walletState, setWalletState] = useState<WalletState>('loading');
  const [wallets, setWallets] = useState<WalletEntry[]>([]);
  const [account, setAccount] = useState<AlgorandAccount | null>(null);
  const [accountUser, setAccountUser] = useState<User | null>(null);
  const [pin, setPin] = useState<string>('');
  const [selectedWallet, setSelectedWallet] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedWallets = localStorage.getItem('decstor_wallets');
      if (storedWallets) {
        const parsedWallets: WalletEntry[] = JSON.parse(storedWallets);
        if (parsedWallets.length > 0) {
          setWallets(parsedWallets);
          setSelectedWallet(parsedWallets[0].address);
          setWalletState('locked');
        } else {
          setWalletState('no_wallet');
        }
      } else {
        setWalletState('no_wallet');
      }
    } catch (error) {
      console.error("Failed to parse wallets from localStorage", error);
      setWalletState('no_wallet');
    }
  }, []);

  const saveWallet = useCallback(async (accountToSave: AlgorandAccount, pinToSave: string, walletName: string) => {
    try {
      const encryptedMnemonic = await encryptMnemonic(accountToSave.mnemonic, pinToSave);
      const newWalletEntry: WalletEntry = { name: walletName, address: accountToSave.addr, encryptedMnemonic };

      const storedWallets = localStorage.getItem('decstor_wallets');
      let currentWallets: WalletEntry[] = storedWallets ? JSON.parse(storedWallets) : [];
      
      const existingWalletIndex = currentWallets.findIndex(w => w.address === newWalletEntry.address);

      if (existingWalletIndex > -1) {
        currentWallets[existingWalletIndex] = newWalletEntry;
      } else {
        currentWallets.push(newWalletEntry);
      }
      
      localStorage.setItem('decstor_wallets', JSON.stringify(currentWallets));
      setWallets(currentWallets);
      setSelectedWallet(newWalletEntry.address);

    } catch (error) {
      console.error("Failed to save wallet", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "Could not save wallet credentials securely."
      });
    }
  }, [toast]);


  const handleCreateWallet = async (mnemonic: string, newPin: string, walletName: string) => {
    try {
      const newAccount = mnemonicToAccount(mnemonic);
      await saveWallet(newAccount, newPin, walletName);
      // Also ensure user exists in DB
      const { user } = await findOrCreateUserInDb(newAccount.addr, walletName);
      setAccount(newAccount);
      setAccountUser(user);
      setPin(newPin);
      setWalletState('unlocked');
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Creation Failed',
        description: 'Could not create the wallet. Please try again.',
      });
      setWalletState('no_wallet');
    }
  };
  
  const handleImportWallet = async (mnemonic: string, newPin: string, walletName: string) => {
    if (!isValidMnemonic(mnemonic)) {
      toast({
        variant: 'destructive',
        title: 'Invalid Mnemonic',
        description: 'The recovery phrase you entered is not valid.',
      });
      return;
    }
    try {
      const newAccount = mnemonicToAccount(mnemonic);
      
      if (wallets.some(w => w.address === newAccount.addr)) {
        toast({ variant: 'destructive', title: 'Wallet Exists', description: 'This wallet has already been imported.' });
        return;
      }
      
      await saveWallet(newAccount, newPin, walletName);
      // Ensure user exists in the database on import
      const { user } = await findOrCreateUserInDb(newAccount.addr, walletName);

      setAccount(newAccount);
      setAccountUser(user);
      setPin(newPin);
      setWalletState('unlocked');
    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Import Failed',
        description: error.message || 'Could not import the wallet. Please check the phrase and try again.',
      });
    }
  };

  const handleUnlock = useCallback(async (address: string, unlockPin: string) => {
    const walletToUnlock = wallets.find(w => w.address === address);

    if (!walletToUnlock || !walletToUnlock.encryptedMnemonic) {
      toast({ variant: 'destructive', title: 'Unlock Failed', description: 'Wallet data not found.' });
      return;
    }
    
    try {
      const mnemonic = await decryptMnemonic(walletToUnlock.encryptedMnemonic, unlockPin);
      if (!mnemonic || !isValidMnemonic(mnemonic)) {
         throw new Error('Decryption failed or invalid mnemonic');
      }
      const unlockedAccount = mnemonicToAccount(mnemonic);

      // Fetch user data from DB on unlock
      const { user } = await findOrCreateUserInDb(unlockedAccount.addr, walletToUnlock.name);

      setAccount(unlockedAccount);
      setAccountUser(user);
      setPin(unlockPin);
      setWalletState('unlocked');
      toast({ title: 'Wallet Unlocked', description: `Welcome back, ${user.walletName}!` });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Unlock Failed',
        description: 'Incorrect PIN. Please try again.',
      });
    }
  }, [toast, wallets]);
  
  const handleLock = () => {
    setAccount(null);
    setAccountUser(null);
    setPin('');
    setWalletState('locked');
  };

  const handleGoToManager = () => {
    setAccount(null);
    setAccountUser(null);
    setPin('');
    if (wallets.length > 0) {
      setWalletState('locked');
    } else {
      setWalletState('no_wallet');
    }
  };

  const handleReset = () => {
      localStorage.removeItem('decstor_wallets');
      setWallets([]);
      setAccount(null);
      setAccountUser(null);
      setPin('');
      setSelectedWallet('');
      setWalletState('no_wallet');
      toast({ title: 'All Wallets Deleted', description: 'You can now create or import a new wallet.' });
  };

  const handleDeleteWallet = (addressToDelete: string) => {
      const newWallets = wallets.filter(w => w.address !== addressToDelete);
      localStorage.setItem('decstor_wallets', JSON.stringify(newWallets));
      setWallets(newWallets);
      toast({ title: 'Wallet Removed' });

      if (newWallets.length === 0) {
        setSelectedWallet('');
        setWalletState('no_wallet');
      } else {
        if (selectedWallet === addressToDelete) {
          setSelectedWallet(newWallets[0].address);
        }
      }
  };

  const handleDeleteActiveWallet = (addressToDelete: string) => {
    const newWallets = wallets.filter(w => w.address !== addressToDelete);
    localStorage.setItem('decstor_wallets', JSON.stringify(newWallets));
    setWallets(newWallets); // Update state immediately
    toast({ title: 'Wallet Removed' });

    // Transition UI correctly
    handleGoToManager();
  }


  // --- CENTRALIZED TRANSACTION HANDLERS ---
  const getSenderAccount = useCallback(async (): Promise<AlgorandAccount> => {
    if (!account) throw new Error("Wallet not unlocked.");

    const storedWallets: WalletEntry[] = JSON.parse(localStorage.getItem('decstor_wallets') || '[]');
    const walletEntry = storedWallets.find(w => w.address === account.addr);
    
    if (!walletEntry) throw new Error("Could not find wallet credentials.");

    const mnemonic = await decryptMnemonic(walletEntry.encryptedMnemonic, pin);
    if (!mnemonic) throw new Error("Decryption failed.");
    
    return mnemonicToAccount(mnemonic);
  }, [account, pin]);

  const handleConfirmSendAlgo = useCallback(async (recipient: string, amount: number) => {
    if (!account) return false;
    try {
      toast({ title: "Sending Transaction...", description: "Please wait while we process your transaction." });
      const senderAccount = await getSenderAccount();
      const { txId } = await sendPayment(senderAccount, recipient, amount);
      
      // Confirm the payment with the backend to create activity logs
      await confirmPayment(account.addr, txId, recipient, amount);
      
      toast({ title: "Transaction Sent!", description: `Successfully sent ${amount} ALGO. TxID: ${truncateAddress(txId, 6, 4)}` });
      return true; // Indicate success
    } catch (error: any) {
      console.error("Send failed:", error);
      toast({ variant: "destructive", title: "Send Failed", description: error.message || "An unknown error occurred." });
      return false; // Indicate failure
    }
  }, [getSenderAccount, toast, account]);

  const handleConfirmSendFile = useCallback(async (file: FileMetadata, recipientAddress: string) => {
     if (!file) return false;
    try {
        toast({ title: "Sending File...", description: "Please approve the transaction to create an on-chain proof-of-send." });
        const senderAccount = await getSenderAccount();
        const {txId} = await sendFile(senderAccount, recipientAddress, file.cid);
        toast({
            title: 'File Sent!',
            description: `Successfully sent ${file.filename} to ${truncateAddress(recipientAddress)}. TxID: ${truncateAddress(txId, 6, 4)}`,
        });
        return true;
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Sending Failed', description: error.message || 'Could not send the file.' });
      return false;
    }
  }, [getSenderAccount, toast]);

  const handleRenameWallet = useCallback(async (newName: string): Promise<boolean> => {
    if (!account || !accountUser) return false;
    if (newName === accountUser.walletName) return true; // No change needed

    try {
        // 1. Update backend
        const { user: updatedUser } = await apiRenameWallet(account.addr, newName);
        
        // 2. Update local storage
        const newWallets = wallets.map(w => w.address === account.addr ? { ...w, name: newName } : w);
        localStorage.setItem('decstor_wallets', JSON.stringify(newWallets));

        // 3. Update component state
        setWallets(newWallets);
        setAccountUser(updatedUser);

        toast({ title: "Wallet Renamed", description: `Your wallet is now named "${newName}".` });
        return true;
    } catch (error: any) {
        console.error("Rename failed:", error);
        toast({ variant: "destructive", title: "Rename Failed", description: error.message || "Could not rename the wallet." });
        return false;
    }
}, [account, accountUser, wallets, toast]);

  // --- END ---

  const renderContent = () => {
    switch (walletState) {
      case 'loading':
        return (
          <div className="flex h-full items-center justify-center">
            <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
          </div>
        );
      case 'no_wallet':
        return (
          <WelcomeScreen
            onCreate={() => setWalletState('creating')}
            onImport={() => setWalletState('importing')}
          />
        );
      case 'creating':
        return <CreateWalletFlow onWalletCreated={handleCreateWallet} onBack={() => wallets.length > 0 ? setWalletState('locked') : setWalletState('no_wallet')} />;
      case 'importing':
        return <ImportWalletScreen onImport={handleImportWallet} onBack={() => wallets.length > 0 ? setWalletState('locked') : setWalletState('no_wallet')} />;
      case 'locked':
        return <LockScreen 
                    wallets={wallets} 
                    selectedWallet={selectedWallet}
                    onSetSelectedWallet={setSelectedWallet}
                    onUnlock={handleUnlock} 
                    onReset={handleReset} 
                    onAddNew={() => setWalletState('creating')} 
                    onImportNew={() => setWalletState('importing')}
                    onDeleteWallet={handleDeleteWallet} 
                />;
      case 'unlocked':
        if (!account || !pin || !accountUser) {
          handleLock();
          return null;
        }
        return <Dashboard 
                  account={account} 
                  user={accountUser}
                  pin={pin} 
                  onLock={handleLock} 
                  onGoToManager={handleGoToManager}
                  onConfirmSendAlgo={handleConfirmSendAlgo}
                  onConfirmSendFile={handleConfirmSendFile}
                  onRenameWallet={handleRenameWallet}
                  onDeleteActiveWallet={handleDeleteActiveWallet}
                />;
      default:
        return null;
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-6xl h-full flex-grow">
        {renderContent()}
      </div>
    </main>
  );
}
