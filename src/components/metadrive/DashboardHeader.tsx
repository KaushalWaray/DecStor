"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { getAccountBalance } from '@/lib/algorand';
import { truncateAddress } from '@/lib/utils';
import type { AlgorandAccount } from '@/types';
import { LogOut, Shield, Copy, LoaderCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DashboardHeaderProps {
  account: AlgorandAccount;
  onLock: () => void;
  onReset: () => void;
}

export default function DashboardHeader({ account, onLock, onReset }: DashboardHeaderProps) {
  const [balance, setBalance] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchBalance = async () => {
      const bal = await getAccountBalance(account.addr);
      setBalance(bal);
    };
    fetchBalance();
  }, [account.addr]);
  
  const handleCopyAddress = () => {
    navigator.clipboard.writeText(account.addr);
    toast({ title: "Address copied!" });
  };

  return (
    <header className="flex items-center justify-between p-4 bg-card rounded-lg shadow-md">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-headline font-bold">MetaDrive</h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <div className="flex items-center gap-2">
            <p className="font-code text-sm text-muted-foreground">{truncateAddress(account.addr)}</p>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyAddress}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <p className="font-semibold text-lg">
            {balance === null ? (
              <LoaderCircle className="h-4 w-4 animate-spin inline-block" />
            ) : (
              `${balance.toFixed(4)} ALGO`
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Button onClick={onLock} variant="secondary">
              <LogOut className="mr-2 h-4 w-4" /> Lock
            </Button>
            <Button onClick={onReset} variant="destructive">
                <RefreshCw className="mr-2 h-4 w-4" /> Reset
            </Button>
        </div>
      </div>
    </header>
  );
}
