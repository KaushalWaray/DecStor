
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { AlgorandAccount, WalletState, WalletEntry } from '@/types';
import { encryptMnemonic, decryptMnemonic } from '@/lib/crypto';
import { mnemonicToAccount, isValidMnemonic } from '@/lib/algorand';
import { useToast } from '@/hooks/use-toast';

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
  const [pin, setPin] = useState<string>('');
  const [selectedWallet, setSelectedWallet] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedWallets = localStorage.getItem('metadrive_wallets');
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

  const saveWallet = useCallback(async (accountToSave: AlgorandAccount, pinToSave: string) => {
    try {
      const encryptedMnemonic = await encryptMnemonic(accountToSave.mnemonic, pinToSave);
      const newWalletEntry: WalletEntry = { address: accountToSave.addr, encryptedMnemonic };

      const storedWallets = localStorage.getItem('metadrive_wallets');
      let currentWallets: WalletEntry[] = storedWallets ? JSON.parse(storedWallets) : [];
      
      const existingWalletIndex = currentWallets.findIndex(w => w.address === newWalletEntry.address);

      if (existingWalletIndex > -1) {
        currentWallets[existingWalletIndex] = newWalletEntry;
      } else {
        currentWallets.push(newWalletEntry);
      }
      
      localStorage.setItem('metadrive_wallets', JSON.stringify(currentWallets));
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


  const handleCreateWallet = async (mnemonic: string, newPin: string) => {
    try {
      const newAccount = mnemonicToAccount(mnemonic);
      await saveWallet(newAccount, newPin);
      setAccount(newAccount);
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
  
  const handleImportWallet = async (mnemonic: string, newPin: string) => {
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
      
      await saveWallet(newAccount, newPin);
      setAccount(newAccount);
      setPin(newPin);
      setWalletState('unlocked');
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Import Failed',
        description: 'Could not import the wallet. Please check the phrase and try again.',
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
      setAccount(unlockedAccount);
      setPin(unlockPin);
      setWalletState('unlocked');
      toast({ title: 'Wallet Unlocked', description: 'Welcome back!' });
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
    setPin('');
    setWalletState('locked');
  };

  const handleGoToManager = () => {
    setAccount(null);
    setPin('');
    if (wallets.length > 0) {
      setWalletState('locked');
    } else {
      setWalletState('no_wallet');
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to delete all wallets? This action cannot be undone.')) {
      localStorage.removeItem('metadrive_wallets');
      setWallets([]);
      setAccount(null);
      setPin('');
      setSelectedWallet('');
      setWalletState('no_wallet');
      toast({ title: 'All Wallets Deleted', description: 'You can now create or import a new wallet.' });
    }
  };

  const handleDeleteWallet = (address: string) => {
      if (window.confirm('Are you sure you want to delete this wallet? This action cannot be undone.')) {
        const newWallets = wallets.filter(w => w.address !== address);
        localStorage.setItem('metadrive_wallets', JSON.stringify(newWallets));
        setWallets(newWallets);
        toast({ title: 'Wallet Deleted' });

        if (newWallets.length === 0) {
            setSelectedWallet('');
            setWalletState('no_wallet');
        } else {
            setSelectedWallet(newWallets[0].address);
        }
      }
  };


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
                    onDeleteWallet={handleDeleteWallet} 
                />;
      case 'unlocked':
        if (!account || !pin) {
          handleLock();
          return null;
        }
        return <Dashboard account={account} pin={pin} onLock={handleLock} onGoToManager={handleGoToManager} />;
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
