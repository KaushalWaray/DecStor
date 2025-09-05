
"use client";

import type { AlgorandAccount, FileMetadata, User } from '@/types';
import DashboardHeader from './DashboardHeader';
import FileTabs from './FileTabs';

interface DashboardProps {
  account: AlgorandAccount;
  user: User;
  pin: string;
  onLock: () => void;
  onGoToManager: () => void;
  onConfirmSendAlgo: (recipient: string, amount: number) => Promise<boolean>;
  onConfirmSendFile: (file: FileMetadata, recipient: string) => Promise<boolean>;
  onRenameWallet: (newName: string) => Promise<boolean>;
}

export default function Dashboard({ account, user, pin, onLock, onGoToManager, onConfirmSendAlgo, onConfirmSendFile, onRenameWallet }: DashboardProps) {

  return (
    <div className="w-full h-full flex flex-col gap-6 animate-fade-in">
      <DashboardHeader 
        account={account}
        user={user} 
        onLock={onLock} 
        onGoToManager={onGoToManager}
        onConfirmSend={onConfirmSendAlgo}
        onRenameWallet={onRenameWallet}
      />
      <main className="flex-grow">
        <FileTabs account={account} pin={pin} onConfirmSendFile={onConfirmSendFile} onConfirmSendAlgo={onConfirmSendAlgo} />
      </main>
    </div>
  );
}
