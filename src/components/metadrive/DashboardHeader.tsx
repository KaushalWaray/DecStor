
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { getAccountBalance } from '@/lib/algorand';
import { truncateAddress } from '@/lib/utils';
import type { AlgorandAccount } from '@/types';
import { LogOut, Shield, Copy, LoaderCircle, Users, ChevronDown, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import ReceiveModal from '../modals/ReceiveModal';
import SendModal from '../modals/SendModal';

interface DashboardHeaderProps {
  account: AlgorandAccount;
  onLock: () => void;
  onGoToManager: () => void;
}

export default function DashboardHeader({ account, onLock, onGoToManager }: DashboardHeaderProps) {
  const [balance, setBalance] = useState<number | null>(null);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
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
    <>
    <header className="flex items-center justify-between p-4 bg-card rounded-lg shadow-md">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-headline font-bold">MetaDrive</h1>
      </div>
      <div className="flex items-center gap-4">

        <div className="flex items-center gap-2">
            <Button onClick={() => setIsSendModalOpen(true)}>
                <ArrowUpRight className="mr-2 h-4 w-4"/> Send
            </Button>
             <Button variant="secondary" onClick={() => setIsReceiveModalOpen(true)}>
                <ArrowDownLeft className="mr-2 h-4 w-4"/> Receive
            </Button>
        </div>

        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10">
                    <div className="flex items-center gap-2">
                        <div className="text-right hidden sm:block">
                            <p className="font-code text-xs text-muted-foreground">{truncateAddress(account.addr)}</p>
                            <p className="font-semibold text-sm">
                                {balance === null ? (
                                <LoaderCircle className="h-4 w-4 animate-spin inline-block" />
                                ) : (
                                `${balance.toFixed(4)} ALGO`
                                )}
                            </p>
                        </div>
                         <ChevronDown className="h-4 w-4 text-muted-foreground"/>
                    </div>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                 <DropdownMenuItem onClick={handleCopyAddress}>
                    <Copy className="mr-2 h-4 w-4" />
                    <span>Copy Address</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onGoToManager}>
                    <Users className="mr-2 h-4 w-4" />
                    <span>Manage Wallets</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onLock}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Lock Wallet</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

    <ReceiveModal 
        isOpen={isReceiveModalOpen}
        onOpenChange={setIsReceiveModalOpen}
        address={account.addr}
    />
    {/* We'll need a way to trigger the send modal, likely from a file */}
    </>
  );
}
