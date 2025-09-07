
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { AlgorandAccount, User } from '@/types';
import { Shield, LoaderCircle, KeyRound, AlertTriangle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { disable2FA } from '@/lib/api';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import Enable2FAModal from '../modals/Enable2FAModal';
import { findOrCreateUserInDb } from '@/lib/api';

interface SecurityTabProps {
    account: AlgorandAccount;
    user: User;
}

export default function SecurityTab({ account, user: initialUser }: SecurityTabProps) {
    const [user, setUser] = useState(initialUser);
    const [isLoading, setIsLoading] = useState(false);
    const [isDisabling, setIsDisabling] = useState(false);
    const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);
    const [isEnableModalOpen, setIsEnableModalOpen] = useState(false);
    const [token, setToken] = useState('');
    const { toast } = useToast();

    const handleDisable = async () => {
        if (!token) {
            toast({ variant: 'destructive', title: 'Token Required', description: 'Please enter a code from your authenticator app.' });
            return;
        }
        setIsDisabling(true);
        try {
            await disable2FA(account.addr, token);
            toast({ title: '2FA Disabled', description: 'Two-factor authentication has been turned off for this wallet.' });
            // Manually update user state to reflect change
            const { user: updatedUser } = await findOrCreateUserInDb(account.addr, user.walletName);
            setUser(updatedUser);

            setIsDisableModalOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Disable Failed', description: error.message });
        } finally {
            setIsDisabling(false);
            setToken('');
        }
    }

    const onEnableSuccess = async () => {
        const { user: updatedUser } = await findOrCreateUserInDb(account.addr, user.walletName);
        setUser(updatedUser);
        setIsEnableModalOpen(false);
    }

    return (
        <>
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl flex items-center gap-2"><Shield /> Two-Factor Authentication (2FA)</CardTitle>
                    <CardDescription>Add an extra layer of security to your wallet. When enabled, you will need a code from your authenticator app to unlock your wallet.</CardDescription>
                </CardHeader>
                <CardContent>
                    {user.twoFactorEnabled ? (
                        <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                            <div>
                                <h3 className="font-semibold text-green-400">2FA is Enabled</h3>
                                <p className="text-sm text-muted-foreground">Your wallet is protected with an extra layer of security.</p>
                            </div>
                            <Button variant="destructive" onClick={() => setIsDisableModalOpen(true)}>Disable 2FA</Button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                             <div>
                                <h3 className="font-semibold">2FA is Disabled</h3>
                                <p className="text-sm text-muted-foreground">Improve your security by enabling 2FA.</p>
                            </div>
                            <Button variant="secondary" onClick={() => setIsEnableModalOpen(true)}>
                                <KeyRound className="mr-2 h-4 w-4" /> Enable 2FA
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Enable2FAModal
                isOpen={isEnableModalOpen}
                onOpenChange={setIsEnableModalOpen}
                account={account}
                user={user}
                onSuccess={onEnableSuccess}
            />

            <AlertDialog open={isDisableModalOpen} onOpenChange={(open) => !open && setIsDisableModalOpen(false)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive" />Disable Two-Factor Authentication?</AlertDialogTitle>
                        <AlertDialogDescription>
                            To confirm, please enter the 6-digit code from your authenticator app.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="my-4">
                        <Label htmlFor="token">Authentication Code</Label>
                        <Input
                            id="token"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            placeholder="123456"
                            maxLength={6}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDisabling}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDisable} disabled={isDisabling || token.length !== 6}>
                            {isDisabling && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                            Disable 2FA
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
