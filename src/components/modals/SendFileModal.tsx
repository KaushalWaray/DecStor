
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
import algosdk from 'algosdk';
import { LoaderCircle, FileText, Send, UserPlus } from 'lucide-react';
import type { FileMetadata, Contact, AlgorandAccount } from '@/types';
import { getContacts } from '@/lib/api';
import { getAccountBalance } from '@/lib/algorand';
import { ALGO_NETWORK_FEE } from '@/lib/constants';
import { getMailboxAppGlobals } from '@/lib/algorand';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';

interface SendFileModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (recipient: string) => void;
  isLoading: boolean;
  file: FileMetadata;
  account: AlgorandAccount;
}

export default function SendFileModal({ isOpen, onOpenChange, onConfirm, isLoading, file, account }: SendFileModalProps) {
  const [recipient, setRecipient] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [feeMicro, setFeeMicro] = useState<number | null>(null);
  const [serviceAddr, setServiceAddr] = useState<string>('');
  const [loadingGlobals, setLoadingGlobals] = useState(false);
  const [balanceAlgos, setBalanceAlgos] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setLoadingGlobals(true);
      const fetchContacts = async () => {
        try {
          const response = await getContacts(account.addr);
          setContacts(response.contacts);
        } catch (error) {
          console.error("Failed to fetch contacts", error);
        }
      };
      const fetchGlobals = async () => {
        try {
          const globals = await getMailboxAppGlobals();
          setFeeMicro(globals.feeMicro || 0);
          setServiceAddr(globals.serviceAddr || '');
        } catch (err) {
          console.warn('Failed to fetch mailbox globals', err);
          setFeeMicro(null);
          setServiceAddr('');
        } finally {
          setLoadingGlobals(false);
        }
      };
      const fetchBalance = async () => {
        try {
          const b = await getAccountBalance(account.addr);
          setBalanceAlgos(b);
        } catch (err) {
          console.warn('Failed to fetch account balance', err);
          setBalanceAlgos(null);
        }
      };
      fetchContacts();
      fetchGlobals();
      fetchBalance();
    }
  }, [isOpen, account.addr]);

  const handleConfirm = () => {
    if (!algosdk.isValidAddress(recipient)) {
      toast({ variant: 'destructive', title: 'Invalid Address', description: 'Please enter a valid Algorand address.' });
      return;
    }
    if (loadingGlobals) {
      toast({ title: 'Please wait', description: 'Loading contract configuration. Try again in a moment.' });
      return;
    }
    if (feeMicro !== null && feeMicro > 0 && !algosdk.isValidAddress(serviceAddr)) {
      toast({ variant: 'destructive', title: 'Invalid Service', description: 'The mailbox service address is not configured on-chain. Contact support or try again later.' });
      return;
    }
    // Balance check: ensure sender has at least fee + network fee
    if (feeMicro !== null && balanceAlgos !== null) {
      const required = (feeMicro || 0) / 1_000_000 + ALGO_NETWORK_FEE;
      if (balanceAlgos < required) {
        toast({ variant: 'destructive', title: 'Insufficient Balance', description: `Your balance (${balanceAlgos.toFixed(6)} ALGO) is less than required ${required.toFixed(6)} ALGO.` });
        return;
      }
    }
    onConfirm(recipient);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2"><Send/>Send File</DialogTitle>
          <DialogDescription>Enter the recipient's Algorand address to send this file.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 my-4">
            <div className="flex items-center gap-3 p-3 rounded-md bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <span className="font-medium truncate">{file.filename}</span>
            </div>

            {/* Mailbox app globals preview */}
            <div className="p-3 rounded-md border bg-background/50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">On-chain Fee</div>
                <div className="font-mono text-sm">{loadingGlobals ? 'Loading…' : feeMicro !== null ? `${(feeMicro / 1_000_000).toFixed(6)} ALGO` : '—'}</div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Service Address</div>
                  <div className="font-mono text-sm truncate text-right max-w-[14rem] break-words">{loadingGlobals ? 'Loading…' : (serviceAddr ? serviceAddr.trim() : 'Not configured')}</div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Your Balance</div>
                  <div className={"font-mono text-sm " + (balanceAlgos !== null && feeMicro !== null && balanceAlgos < (feeMicro/1_000_000 + ALGO_NETWORK_FEE) ? 'text-red-600' : '')}>
                    {balanceAlgos === null ? (loadingGlobals ? 'Loading…' : '—') : `${balanceAlgos.toFixed(6)} ALGO`}
                  </div>
                </div>
            </div>

            {contacts.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="contact-select">Select from Contacts</Label>
                <Select onValueChange={(value) => setRecipient(value)}>
                  <SelectTrigger id="contact-select">
                    <SelectValue placeholder="Choose a saved contact..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((contact) => (
                      <SelectItem key={contact._id} value={contact.address}>
                        {contact.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                 <div className="flex items-center gap-2">
                    <Separator className="flex-1" />
                    <span className="text-xs text-muted-foreground">OR</span>
                    <Separator className="flex-1" />
                 </div>
              </div>
            )}

            <div className="space-y-2">
                <Label htmlFor="recipient-address">
                Recipient Address
                </Label>
                <Input
                id="recipient-address"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="font-code"
                placeholder="Paste Algorand address here..."
                disabled={isLoading}
                />
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={isLoading || !recipient}>
            {isLoading ? (
                <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    <span>Validating...</span>
                </>
            ) : (
                "Review & Send"
            )}
            
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
