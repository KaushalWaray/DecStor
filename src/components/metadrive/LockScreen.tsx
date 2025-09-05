
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LockKeyhole, Eye, EyeOff, LoaderCircle, PlusCircle, Trash2, Download } from 'lucide-react';
import { truncateAddress } from '@/lib/utils';
import type { WalletEntry } from '@/types';

interface LockScreenProps {
  wallets: WalletEntry[];
  selectedWallet: string;
  onSetSelectedWallet: (address: string) => void;
  onUnlock: (address: string, pin: string) => void;
  onReset: () => void;
  onAddNew: () => void;
  onImportNew: () => void;
  onDeleteWallet: (address: string) => void;
}

export default function LockScreen({ wallets, selectedWallet, onSetSelectedWallet, onUnlock, onReset, onAddNew, onImportNew, onDeleteWallet }: LockScreenProps) {
  const [pin, setPin] = useState('');
  const [isPinVisible, setIsPinVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleUnlock = async () => {
    if (!selectedWallet) {
        alert("Please select a wallet to unlock.");
        return;
    }
    setIsLoading(true);
    await onUnlock(selectedWallet, pin);
    setIsLoading(false);
    // Clear pin after unlock attempt
    setPin('');
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleUnlock();
    }
  };
  
  const handleDelete = () => {
      if(selectedWallet) {
          onDeleteWallet(selectedWallet);
      }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit">
            <LockKeyhole className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="text-3xl font-headline mt-4">Wallet Locked</CardTitle>
          <CardDescription>Select a wallet and enter the PIN to unlock.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedWallet} onValueChange={onSetSelectedWallet}>
            <SelectTrigger>
              <SelectValue placeholder="Select a wallet" />
            </SelectTrigger>
            <SelectContent>
              {wallets.map((wallet) => (
                <SelectItem key={wallet.address} value={wallet.address}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{wallet.name || 'Unnamed Wallet'}</span>
                    <span className="text-muted-foreground font-code text-xs">{truncateAddress(wallet.address)}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Input
              id="pin"
              type={isPinVisible ? 'text' : 'password'}
              placeholder="Enter your PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={handleKeyPress}
              className="pr-10"
              disabled={!selectedWallet}
            />
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setIsPinVisible(!isPinVisible)}>
              {isPinVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button size="lg" className="w-full" onClick={handleUnlock} disabled={isLoading || !selectedWallet || pin.length < 6}>
              {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Unlock
            </Button>
            <Button size="lg" variant="destructive" onClick={handleDelete} disabled={isLoading || !selectedWallet}>
                <Trash2 />
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
            <Button variant="secondary" className="w-full" onClick={onAddNew}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Wallet
            </Button>
            <Button variant="secondary" className="w-full" onClick={onImportNew}>
                <Download className="mr-2 h-4 w-4" /> Import Existing Wallet
            </Button>
            <Button variant="link" className="text-sm text-muted-foreground" onClick={onReset}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete All Wallets
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
