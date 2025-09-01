"use client";

import { useState, useEffect, useCallback } from 'react';
import type { AlgorandAccount, WalletState } from '@/types';
import { decryptMnemonic } from '@/lib/crypto';
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
  const [account, setAccount] = useState<AlgorandAccount | null>(null);
  const [pin, setPin] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    const encryptedMnemonic = localStorage.getItem('metadrive_wallet');
    if (encryptedMnemonic) {
      setWalletState('locked');
    } else {
      setWalletState('no_wallet');
    }
  }, []);

  const handleCreateWallet = (mnemonic: string, newPin: string) => {
    try {
      const newAccount = mnemonicToAccount(mnemonic);
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
  
  const handleImportWallet = (mnemonic: string, newPin: string) => {
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

  const handleUnlock = useCallback(async (unlockPin: string) => {
    const encryptedMnemonic = localStorage.getItem('metadrive_wallet');
    if (!encryptedMnemonic) {
      setWalletState('no_wallet');
      return;
    }
    try {
      const mnemonic = await decryptMnemonic(encryptedMnemonic, unlockPin);
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
  }, [toast]);
  
  const handleLock = () => {
    setAccount(null);
    setPin('');
    setWalletState('locked');
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset? This will delete your encrypted wallet from this device. This action cannot be undone.')) {
      localStorage.removeItem('metadrive_wallet');
      setAccount(null);
      setPin('');
      setWalletState('no_wallet');
      toast({ title: 'Wallet Reset', description: 'You can now create or import a new wallet.' });
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
        return <CreateWalletFlow onWalletCreated={handleCreateWallet} onBack={() => setWalletState('no_wallet')} />;
      case 'importing':
        return <ImportWalletScreen onImport={handleImportWallet} onBack={() => setWalletState('no_wallet')} />;
      case 'locked':
        return <LockScreen onUnlock={handleUnlock} onReset={handleReset} />;
      case 'unlocked':
        if (!account || !pin) {
          // This should not happen, but as a fallback
          handleLock();
          return null;
        }
        return <Dashboard account={account} pin={pin} onLock={handleLock} />;
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
