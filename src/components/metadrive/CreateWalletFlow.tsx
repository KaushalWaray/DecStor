
"use client";

import { useState, useMemo, useEffect } from 'react';
import { generateAccount } from '@/lib/algorand';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, ArrowLeft, Eye, EyeOff, LoaderCircle, ArrowRight, Shuffle } from 'lucide-react';

interface CreateWalletFlowProps {
  onWalletCreated: (mnemonic: string, pin: string) => void;
  onBack: () => void;
}

// Helper to shuffle an array
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export default function CreateWalletFlow({ onWalletCreated, onBack }: CreateWalletFlowProps) {
  const [step, setStep] = useState<'display' | 'confirm' | 'pin'>('display');
  const [mnemonic, setMnemonic] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isPinVisible, setIsPinVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // State for the new confirmation flow
  const [confirmationIndices, setConfirmationIndices] = useState<number[]>([]);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [shuffledMnemonic, setShuffledMnemonic] = useState<string[]>([]);

  const mnemonicWords = useMemo(() => mnemonic.split(' '), [mnemonic]);

  useMemo(() => {
    if(!mnemonic) {
      const newAccount = generateAccount();
      setMnemonic(newAccount.mnemonic);
    }
  }, [mnemonic]);

  useEffect(() => {
    if (step === 'confirm' && mnemonicWords.length === 25) {
        // Select 3 unique random indices to ask for confirmation
        const indices = new Set<number>();
        while(indices.size < 3) {
            indices.add(Math.floor(Math.random() * 25));
        }
        setConfirmationIndices(Array.from(indices).sort((a,b) => a - b));

        // Shuffle the mnemonic for display
        setShuffledMnemonic(shuffleArray(mnemonicWords));
        setSelectedWords([]); // Reset selected words
    }
  }, [step, mnemonicWords]);

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(mnemonic);
    toast({ title: 'Copied to clipboard!' });
  };
  
  const handleWordSelection = (word: string) => {
    if (selectedWords.length < 3) {
        setSelectedWords([...selectedWords, word]);
    }
  };
  
  const handleConfirmMnemonic = () => {
    const correctWords = confirmationIndices.map(index => mnemonicWords[index]);
    if (JSON.stringify(selectedWords) === JSON.stringify(correctWords)) {
        toast({ title: "Phrase Confirmed!", description: "You're all set. Now create a PIN."});
        setStep('pin');
    } else {
        toast({ variant: 'destructive', title: 'Incorrect Words', description: 'The words you selected do not match. Please try again.' });
        setSelectedWords([]); // Reset for another try
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
    await onWalletCreated(mnemonic, pin);
  };
  
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
                <Button onClick={() => setStep('confirm')}>Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </div>
            </CardFooter>
          </Card>
        );

      case 'confirm':
        return (
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="font-headline text-2xl">Confirm Recovery Phrase</CardTitle>
              <CardDescription>
                To confirm you saved your phrase, please select the following words in order: 
                <strong className="text-primary font-bold"> Word #{confirmationIndices[0] + 1}</strong>, 
                <strong className="text-primary font-bold"> #{confirmationIndices[1] + 1}</strong>, and 
                <strong className="text-primary font-bold"> #{confirmationIndices[2] + 1}</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="p-4 border rounded-md bg-muted/20 min-h-[7rem] flex items-center justify-center gap-4 font-code text-lg">
                    {selectedWords.map((word, index) => (
                        <div key={index} className="bg-background p-2 rounded-md shadow-sm">
                            {word}
                        </div>
                    ))}
                    {selectedWords.length < 3 && <div className="w-16 h-8 bg-muted animate-pulse rounded-md" />}
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mt-4">
                    {shuffledMnemonic.map((word, index) => {
                        const isSelected = selectedWords.includes(word);
                        return (
                            <Button 
                                key={index} 
                                variant={isSelected ? "secondary" : "outline"}
                                className={`font-code ${isSelected ? 'opacity-50' : ''}`}
                                onClick={() => handleWordSelection(word)}
                                disabled={isSelected}
                            >
                                {word}
                            </Button>
                        )
                    })}
                </div>
            </CardContent>
            <CardFooter className="justify-between">
              <Button variant="ghost" onClick={() => setStep('display')}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
               <Button 
                    variant="secondary" 
                    size="icon" 
                    onClick={() => setSelectedWords([])}
                    title="Clear selection"
                >
                    <Shuffle className="h-4 w-4"/>
              </Button>
              <Button onClick={handleConfirmMnemonic} disabled={selectedWords.length !== 3}>Confirm</Button>
            </CardFooter>
          </Card>
        );

      case 'pin':
        return (
          <Card className="w-full max-w-sm">
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

