
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { isValidMnemonic, mnemonicToAccount } from '@/lib/algorand';
import { truncateAddress } from '@/lib/utils';

interface ImportWalletScreenProps {
  onImport: (mnemonic: string, pin: string, name: string) => Promise<void>;
  onBack: () => void;
}

export default function ImportWalletScreen({ onImport, onBack }: ImportWalletScreenProps) {
  const [mnemonic, setMnemonic] = useState('');
  const [walletName, setWalletName] = useState('');
  const [pin, setPin] = useState('');
  const [isPinVisible, setIsPinVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleMnemonicChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newMnemonic = e.target.value;
    setMnemonic(newMnemonic);
    if (isValidMnemonic(newMnemonic)) {
      const account = mnemonicToAccount(newMnemonic);
      setWalletName(`Wallet ${truncateAddress(account.addr, 4, 4)}`);
    } else {
      setWalletName('');
    }
  }

  const handleImport = async () => {
    const trimmedMnemonic = mnemonic.trim();
    if (!trimmedMnemonic || !isValidMnemonic(trimmedMnemonic)) {
      toast({ variant: 'destructive', title: 'Invalid Phrase', description: 'Please enter a valid 25-word recovery phrase.' });
      return;
    }
     if (!walletName.trim()) {
      toast({ variant: 'destructive', title: 'Invalid Name', description: 'Wallet name cannot be empty.' });
      return;
    }
    if (pin.length < 6) {
      toast({ variant: 'destructive', title: 'Invalid PIN', description: 'PIN must be at least 6 digits long.' });
      return;
    }
    setIsLoading(true);
    await onImport(trimmedMnemonic, pin, walletName);
    // No need to set loading to false as the component will unmount or be replaced
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Import Existing Wallet</CardTitle>
          <CardDescription>Enter your 25-word secret recovery phrase, name the wallet, and set a new PIN for this device.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mnemonic">Recovery Phrase</Label>
            <Textarea
              id="mnemonic"
              placeholder="Enter your 25 words..."
              className="font-code h-40"
              value={mnemonic}
              onChange={handleMnemonicChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wallet-name">Wallet Name</Label>
            <Input id="wallet-name" value={walletName} onChange={(e) => setWalletName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pin">New PIN (6+ digits)</Label>
            <div className="relative">
              <Input id="pin" type={isPinVisible ? 'text' : 'password'} value={pin} onChange={(e) => setPin(e.target.value)} />
              <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setIsPinVisible(!isPinVisible)}>
                {isPinVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-between">
          <Button variant="ghost" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
          <Button onClick={handleImport} disabled={isLoading}>
            {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            Import and Unlock
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
