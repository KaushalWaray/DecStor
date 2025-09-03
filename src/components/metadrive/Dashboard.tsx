
"use client";

import type { AlgorandAccount } from '@/types';
import DashboardHeader from './DashboardHeader';
import FileTabs from './FileTabs';

interface DashboardProps {
  account: AlgorandAccount;
  pin: string;
  onLock: () => void;
  onGoToManager: () => void;
}

export default function Dashboard({ account, pin, onLock, onGoToManager }: DashboardProps) {

  return (
    <div className="w-full h-full flex flex-col gap-6 animate-fade-in">
      <DashboardHeader account={account} onLock={onLock} onGoToManager={onGoToManager}/>
      <main className="flex-grow">
        <FileTabs account={account} pin={pin} />
      </main>
    </div>
  );
}
