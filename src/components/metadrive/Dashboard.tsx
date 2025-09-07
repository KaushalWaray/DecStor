
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { AlgorandAccount, FileMetadata, User } from '@/types';
import DashboardHeader from './DashboardHeader';
import FileTabs from './FileTabs';
import { getAccountBalance } from '@/lib/algorand';

interface DashboardProps {
  account: AlgorandAccount;
  user: User;
  pin: string;
  onLock: () => void;
  onGoToManager: () => void;
  onConfirmSendAlgo: (recipient: string, amount: number) => Promise<boolean>;
  onConfirmSendFile: (file: FileMetadata, recipient: string) => Promise<boolean>;
  onRenameWallet: (newName: string) => Promise<boolean>;
  onDeleteActiveWallet: (address: string) => void;
}

export default function Dashboard({ account, user, pin, onLock, onGoToManager, onConfirmSendAlgo, onConfirmSendFile, onRenameWallet, onDeleteActiveWallet }: DashboardProps) {
  const [balance, setBalance] = useState<number | null>(null);

  const fetchBalance = useCallback(async () => {
    const bal = await getAccountBalance(account.addr);
    setBalance(bal);
  }, [account.addr]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const handleConfirmSendAlgoAndRefresh = async (recipient: string, amount: number): Promise<boolean> => {
      const success = await onConfirmSendAlgo(recipient, amount);
      if (success) {
          fetchBalance(); // Refresh balance after a successful send
      }
      return success;
  };


  return (
    <div className="w-full h-full flex flex-col gap-6 animate-fade-in">
      <DashboardHeader 
        account={account}
        user={user} 
        balance={balance}
        onLock={onLock} 
        onGoToManager={onGoToManager}
        onConfirmSend={handleConfirmSendAlgoAndRefresh}
        onRenameWallet={onRenameWallet}
        onDeleteActiveWallet={onDeleteActiveWallet}
      />
      <main className="flex-grow">
        <FileTabs 
            account={account} 
            user={user}
            pin={pin} 
            balance={balance ?? 0}
            onConfirmSendFile={onConfirmSendFile} 
            onConfirmSendAlgo={handleConfirmSendAlgoAndRefresh} 
        />
      </main>
    </div>
  );
}
