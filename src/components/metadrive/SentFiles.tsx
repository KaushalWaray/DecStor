
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { getSentShares } from '@/lib/api';
import { truncateAddress } from '@/lib/utils';
import type { AlgorandAccount, ShareRecord } from '@/types';
import { LoaderCircle, Send, RefreshCw, FileText, User } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface SentFilesProps {
    account: AlgorandAccount;
}

export default function SentFiles({ account }: SentFilesProps) {
    const [shares, setShares] = useState<ShareRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const fetchSentShares = useCallback(async (isInitial = false) => {
        if (!isInitial) setIsLoading(true);
        try {
            const response = await getSentShares(account.addr);
            setShares(response.shares || []);
            if (!isInitial) {
                toast({ title: "Refreshed Sent Files" });
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsLoading(false);
        }
    }, [account.addr, toast]);

    useEffect(() => {
        fetchSentShares(true);
    }, [fetchSentShares]);
    
    return (
        <Card className="max-w-4xl mx-auto">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="font-headline text-2xl flex items-center gap-2"><Send /> Sent Files</CardTitle>
                    <CardDescription>A list of all files you have shared with others.</CardDescription>
                </div>
                 <Button onClick={() => fetchSentShares(false)} disabled={isLoading} variant="outline">
                    {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Refresh
                </Button>
            </CardHeader>
            <CardContent>
                {isLoading && shares.length === 0 ? (
                    <div className="flex justify-center items-center h-40"><LoaderCircle className="h-8 w-8 animate-spin text-primary" /></div>
                ) : shares.length === 0 ? (
                    <div className="text-center text-muted-foreground py-10">
                        <p>You haven't shared any files yet.</p>
                        <p className="text-sm">Shared files will appear here.</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-border">
                        {shares.map((share) => (
                            <li key={share._id} className="flex items-center justify-between p-3 gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <FileText className="h-6 w-6 text-primary flex-shrink-0" />
                                    <div className="min-w-0">
                                        <p className="font-semibold truncate">{share.filename}</p>
                                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                                            <User className="h-3 w-3" />
                                            Sent to <span className="font-code text-xs">{truncateAddress(share.recipientAddress)}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                     <p 
                                        className="text-sm font-medium"
                                        title={format(new Date(share.createdAt), 'PPP p')}
                                    >
                                        {formatDistanceToNow(new Date(share.createdAt), { addSuffix: true })}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
