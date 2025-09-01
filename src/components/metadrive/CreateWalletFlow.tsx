"use client";

import { useState, useMemo, useCallback } from 'react';
import { generateAccount } from '@/lib/algorand';
import { encryptMnemonic } from '@/lib/crypto';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, ArrowLeft, Eye, EyeOff, LoaderCircle } from 'lucide-react';

type Step = 'display' | 'confirm' | 'pin';

interface CreateWalletFlowProps {
  onWalletCreated: (mnemonic: string, pin: string) => void;
  onBack: () => void;
}

export default function CreateWalletFlow({ onWalletCreated, onBack }: CreateWalletFlowProps) {
  const [step, setStep] = useState<Step>('display');
  const [mnemonic, setMnemonic] = useState('');
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isPinVisible, setIsPinVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useMemo(() => {
    if(!mnemonic) {
      const newAccount = generateAccount();
      setMnemonic(newAccount.mnemonic);
    }
  }, [mnemonic]);

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(mnemonic);
    toast({ title: 'Copied to clipboard!' });
  };
  
  const handleConfirmMnemonic = () => {
    if (confirmationPhrase.trim() !== mnemonic.trim()) {
      toast({ variant: 'destructive', title: 'Incorrect Phrase', description: 'The recovery phrase does not match. Please check and try again.' });
    } else {
      setStep('pin');
    }
  };

  const handleCreateWallet = async () => {
    if (pin.length < 6) {
      toast({ variant: 'destructive', title: 'Invalid PIN', description: 'PIN must be at least 6 digits long.' });
      return;
    }
    if (pin !== confirmPin) {
      toast({ variant: 'destructive', title: 'PINs Do Not Match', description: 'Please ensure both PINs are the same.' });
      return;
    }

    setIsLoading(true);
    try {
      const encryptedMnemonic = await encryptMnemonic(mnemonic, pin);
      localStorage.setItem('metadrive_wallet', encryptedMnemonic);
      onWalletCreated(mnemonic, pin);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create wallet. Please try again.' });
      setIsLoading(false);
    }
  };
  
  const mnemonicWords = mnemonic.split(' ');

  const renderStep = () => {
    switch (step) {
      case 'display':
        return (
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="font-headline text-2xl">Your Secret Recovery Phrase</CardTitle>
              <CardDescription>Write down or copy these words in the right order and save them somewhere safe.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 border rounded-md bg-muted/20 font-code">
                {mnemonicWords.map((word, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-muted-foreground w-6 text-right">{index + 1}.</span>
                    <span>{word}</span>
                  </div>
                ))}
              </div>
               <div className="mt-4 p-4 border-l-4 border-destructive bg-destructive/10 text-destructive-foreground">
                <h4 className="font-bold">Do not share this phrase with anyone!</h4>
                <p className="text-sm">These words can be used to steal all your assets.</p>
              </div>
            </CardContent>
            <CardFooter className="justify-between">
              <Button variant="ghost" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
              <div className="flex gap-2">
                 <Button variant="secondary" onClick={handleCopyToClipboard}><Copy className="mr-2 h-4 w-4" />Copy</Button>
                <Button onClick={() => setStep('confirm')}>Next <ArrowLeft className="mr-2 h-4 w-4 rotate-180" /></Button>
              </div>
            </CardFooter>
          </Card>
        );

      case 'confirm':
        return (
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle className="font-headline text-2xl">Confirm Recovery Phrase</CardTitle>
              <CardDescription>Enter your 25-word recovery phrase to confirm you have saved it.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Enter the 25 words you saved..."
                className="font-code h-40"
                value={confirmationPhrase}
                onChange={(e) => setConfirmationPhrase(e.target.value)}
              />
            </CardContent>
            <CardFooter className="justify-between">
              <Button variant="ghost" onClick={() => setStep('display')}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
              <Button onClick={handleConfirmMnemonic}>Confirm</Button>
            </CardFooter>
          </Card>
        );

      case 'pin':
        return (
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle className="font-headline text-2xl">Create a PIN</CardTitle>
              <CardDescription>This PIN will be used to unlock your wallet on this device.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pin">New PIN (6+ digits)</Label>
                 <div className="relative">
                  <Input id="pin" type={isPinVisible ? 'text' : 'password'} value={pin} onChange={(e) => setPin(e.target.value)} />
                  <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setIsPinVisible(!isPinVisible)}>
                    {isPinVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                 </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-pin">Confirm PIN</Label>
                <Input id="confirm-pin" type={isPinVisible ? 'text' : 'password'} value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} />
              </div>
            </CardContent>
            <CardFooter className="justify-between">
              <Button variant="ghost" onClick={() => setStep('confirm')}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
              <Button onClick={handleCreateWallet} disabled={isLoading}>
                {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                Create Wallet
              </Button>
            </CardFooter>
          </Card>
        );
    }
  };

  return <div className="flex flex-col items-center justify-center h-full">{renderStep()}</div>;
}
