
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle, KeyRound, Copy } from 'lucide-react';
import QRCode from 'qrcode.react';
import { generate2FASecret, verify2FAToken } from '@/lib/api';
import type { AlgorandAccount, User } from '@/types';

interface Enable2FAModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  account: AlgorandAccount;
  user: User;
  onSuccess: () => void;
}

export default function Enable2FAModal({ isOpen, onOpenChange, account, user, onSuccess }: Enable2FAModalProps) {
  const [step, setStep] = useState<'generate' | 'verify'>('generate');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const response = await generate2FASecret(account.addr, user.walletName);
      setQrCodeUrl(response.otpauth_url);
      setSecret(response.secret);
      setStep('verify');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Failed to Generate Secret', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!token) {
        toast({ variant: 'destructive', title: 'Token Required', description: 'Please enter a code from your authenticator app.' });
        return;
    }
    setIsLoading(true);
    try {
        const response = await verify2FAToken(account.addr, token);
        if (response.verified) {
            toast({ title: '2FA Enabled!', description: 'Your wallet is now secured with two-factor authentication.' });
            onSuccess();
        } else {
            toast({ variant: 'destructive', title: 'Verification Failed', description: response.message || 'The token was incorrect. Please try again.' });
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Verification Failed', description: error.message });
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal is opened
      setStep('generate');
      setQrCodeUrl('');
      setSecret('');
      setToken('');
      setIsLoading(false);
      handleGenerate(); // Automatically start the process
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const renderContent = () => {
    if (isLoading && step === 'generate') {
      return (
        <div className="flex items-center justify-center h-48">
          <LoaderCircle className="h-10 w-10 animate-spin text-primary" />
        </div>
      );
    }

    if (step === 'verify') {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Scan the QR code with your authenticator app (e.g., Google Authenticator, Authy), then enter the 6-digit code below to complete setup.</p>
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-white rounded-lg">
                {qrCodeUrl && <QRCode value={qrCodeUrl} size={200} level="H" />}
            </div>
            <div>
              <Label>Can't scan? Enter this code manually:</Label>
               <div className="relative mt-1">
                    <Input readOnly value={secret} className="font-code pr-10" />
                    <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => {navigator.clipboard.writeText(secret); toast({title: "Secret Copied!"})}}>
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="token">Verification Code</Label>
            <Input
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456"
              maxLength={6}
              disabled={isLoading}
            />
          </div>
        </div>
      );
    }

    return null; // Should not be reached
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2"><KeyRound/>Enable Two-Factor Authentication</DialogTitle>
          <DialogDescription>
            Follow the steps to secure your wallet with 2FA.
          </DialogDescription>
        </DialogHeader>
        <div className="my-4">
            {renderContent()}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          {step === 'verify' && (
            <Button onClick={handleVerify} disabled={isLoading || token.length !== 6}>
              {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : 'Verify & Enable'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    