
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { isValidMnemonic } from '@/lib/algorand';

interface ImportWalletScreenProps {
  onImport: (mnemonic: string, pin: string) => void;
  onBack: () => void;
}

export default function ImportWalletScreen({ onImport, onBack }: ImportWalletScreenProps) {
  const [mnemonic, setMnemonic] = useState('');
  const [pin, setPin] = useState('');
  const [isPinVisible, setIsPinVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleImport = async () => {
    const trimmedMnemonic = mnemonic.trim();
    if (!trimmedMnemonic || !isValidMnemonic(trimmedMnemonic)) {
      toast({ variant: 'destructive', title: 'Invalid Phrase', description: 'Please enter a valid 25-word recovery phrase.' });
      return;
    }
    if (pin.length < 6) {
      toast({ variant: 'destructive', title: 'Invalid PIN', description: 'PIN must be at least 6 digits long.' });
      return;
    }
    setIsLoading(true);
    // No need to save here anymore, it will be handled on the main page
    onImport(trimmedMnemonic, pin);
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Import Existing Wallet</CardTitle>
          <CardDescription>Enter your 25-word secret recovery phrase and set a new PIN for this device.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mnemonic">Recovery Phrase</Label>
            <Textarea
              id="mnemonic"
              placeholder="Enter your 25 words..."
              className="font-code h-40"
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
            />
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
