
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { setEmailForNotifications } from '@/lib/api';
import type { AlgorandAccount, User } from '@/types';
import { Bell, LoaderCircle, CheckCircle2 } from 'lucide-react';
import { findOrCreateUserInDb } from '@/lib/api';

interface NotificationsTabProps {
    account: AlgorandAccount;
    user: User;
}

export default function NotificationsTab({ account, user: initialUser }: NotificationsTabProps) {
    const [user, setUser] = useState(initialUser);
    const [email, setEmail] = useState(user.email || '');
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleUpdateEmail = async () => {
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            toast({ variant: 'destructive', title: 'Invalid Email', description: 'Please enter a valid email address.' });
            return;
        }
        setIsLoading(true);
        try {
            const result = await setEmailForNotifications(account.addr, email);
            toast({ title: 'Verification Email Sent', description: result.message });
            // Refresh user data to show the unverified email state
            const { user: updatedUser } = await findOrCreateUserInDb(account.addr);
            setUser(updatedUser);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    const isEmailUnchanged = email === user.email;

    return (
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle className="font-headline text-2xl flex items-center gap-2"><Bell /> Email Notifications</CardTitle>
                <CardDescription>Get notified about important account activity, such as transactions and file shares. We'll send a verification link to confirm your address.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {user.emailVerified && user.email ? (
                    <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <div>
                            <h3 className="font-semibold text-green-400 flex items-center gap-2">
                                <CheckCircle2 /> Notifications are Active
                            </h3>
                            <p className="text-sm text-muted-foreground">Emails are being sent to <span className="font-mono">{user.email}</span>.</p>
                        </div>
                    </div>
                ) : user.email && !user.emailVerified ? (
                     <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <h3 className="font-semibold text-amber-400">Verification Pending</h3>
                        <p className="text-sm text-muted-foreground">A verification link was sent to <span className="font-mono">{user.email}</span>. Please check your inbox and spam folder.</p>
                    </div>
                ) : null}

                <div className="space-y-2">
                    <Label htmlFor="email">Notification Email</Label>
                    <div className="flex gap-2">
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your.email@example.com"
                        />
                        <Button onClick={handleUpdateEmail} disabled={isLoading || isEmailUnchanged}>
                            {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                            {user.email ? 'Update' : 'Save'}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
