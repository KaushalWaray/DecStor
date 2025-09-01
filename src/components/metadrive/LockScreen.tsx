"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LockKeyhole, Eye, EyeOff, LoaderCircle } from 'lucide-react';

interface LockScreenProps {
  onUnlock: (pin: string) => void;
  onReset: () => void;
}

export default function LockScreen({ onUnlock, onReset }: LockScreenProps) {
  const [pin, setPin] = useState('');
  const [isPinVisible, setIsPinVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleUnlock = async () => {
    setIsLoading(true);
    await onUnlock(pin);
    // If unlock fails, onUnlock in parent will show a toast.
    // We can reset loading state regardless.
    setIsLoading(false);
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleUnlock();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit">
            <LockKeyhole className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="text-3xl font-headline mt-4">Wallet Locked</CardTitle>
          <CardDescription>Enter your PIN to unlock.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Input
              id="pin"
              type={isPinVisible ? 'text' : 'password'}
              placeholder="Enter your PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={handleKeyPress}
              className="pr-10"
            />
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setIsPinVisible(!isPinVisible)}>
              {isPinVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <Button size="lg" className="w-full" onClick={handleUnlock} disabled={isLoading}>
            {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            Unlock
          </Button>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button variant="link" className="text-sm text-muted-foreground" onClick={onReset}>
            Forgot PIN? Reset Wallet
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
