
"use client";

import { useEffect } from 'react';
import type { AlgorandAccount } from '@/types';
import DashboardHeader from './DashboardHeader';
import FileTabs from './FileTabs';

interface DashboardProps {
  account: AlgorandAccount;
  pin: string;
  onLock: () => void;
  onGoToManager: () => void;
  onSaveWallet: (account: AlgorandAccount, pin: string) => void;
}

export default function Dashboard({ account, pin, onLock, onGoToManager, onSaveWallet }: DashboardProps) {

  useEffect(() => {
    // This effect runs when the dashboard loads.
    // If it's a newly created wallet, this is the first chance to save it.
    // It's safe to run this every time, as the save function handles existing wallets.
    onSaveWallet(account, pin);
  }, [account, pin, onSaveWallet]);

  return (
    <div className="w-full h-full flex flex-col gap-6 animate-fade-in">
      <DashboardHeader account={account} onLock={onLock} onGoToManager={onGoToManager}/>
      <main className="flex-grow">
        <FileTabs account={account} pin={pin} />
      </main>
    </div>
  );
}
