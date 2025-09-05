
"use client";

import type { AlgorandAccount, FileMetadata } from '@/types';
import DashboardHeader from './DashboardHeader';
import FileTabs from './FileTabs';

interface DashboardProps {
  account: AlgorandAccount;
  pin: string;
  onLock: () => void;
  onGoToManager: () => void;
  onConfirmSendAlgo: (recipient: string, amount: number) => Promise<boolean>;
  onConfirmSendFile: (file: FileMetadata, recipient: string) => Promise<boolean>;
}

export default function Dashboard({ account, pin, onLock, onGoToManager, onConfirmSendAlgo, onConfirmSendFile }: DashboardProps) {

  return (
    <div className="w-full h-full flex flex-col gap-6 animate-fade-in">
      <DashboardHeader 
        account={account} 
        onLock={onLock} 
        onGoToManager={onGoToManager}
        onConfirmSend={onConfirmSendAlgo}
      />
      <main className="flex-grow">
        <FileTabs account={account} pin={pin} onConfirmSendFile={onConfirmSendFile} />
      </main>
    </div>
  );
}

    