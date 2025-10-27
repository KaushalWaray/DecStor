"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import algosdk from 'algosdk';
import type { FileMetadata, AlgorandAccount } from '@/types';
import { getMailboxAppGlobals, bulkShare, postBulkCommit } from '@/lib/algorand';
import crypto from 'crypto';
import { LoaderCircle } from 'lucide-react';

interface BulkShareModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFiles: FileMetadata[];
  account: AlgorandAccount;
}

export default function BulkShareModal({ isOpen, onOpenChange, selectedFiles, account }: BulkShareModalProps) {
  const [recipient, setRecipient] = useState('');
  const [feeMicro, setFeeMicro] = useState<number>(0);
  const [serviceAddr, setServiceAddr] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      (async () => {
        try {
          const g = await getMailboxAppGlobals();
          setFeeMicro(g.feeMicro || 0);
          setServiceAddr(g.serviceAddr || '');
        } catch (e) {
          console.warn('Failed to load globals', e);
        }
      })();
    }
  }, [isOpen]);

  const count = selectedFiles.length;
  const totalMicro = BigInt(feeMicro) * BigInt(count);
  const totalAlgo = Number(totalMicro) / 1_000_000;

  function computeMerkleLikeRoot(cids: string[]) {
    const concat = cids.join('|');
    return crypto.createHash('sha256').update(concat).digest('hex');
  }

  const handleConfirm = async () => {
    if (!recipient || !algosdk.isValidAddress(recipient)) {
      toast({ variant: 'destructive', title: 'Invalid recipient', description: 'Please provide a valid Algorand address.' });
      return;
    }
    if (count === 0) {
      toast({ variant: 'destructive', title: 'No files selected', description: 'Please select files to share.' });
      return;
    }

    setLoading(true);
    try {
      const cids = selectedFiles.map(f => f.cid);
      const merkleRoot = computeMerkleLikeRoot(cids);

      // submit on-chain bulk share
      const { txId } = await bulkShare(account, merkleRoot, count);
      toast({ title: 'Transaction submitted', description: `App-call tx ${txId} confirmed.` });

      // inform backend mapping
      const res = await postBulkCommit(merkleRoot, cids, recipient);
      toast({ title: 'Backend updated', description: res.message || 'Bulk mapping posted.' });

      onOpenChange(false);
    } catch (err: any) {
      console.error('Bulk share failed', err);
      toast({ variant: 'destructive', title: 'Bulk share failed', description: err?.message || String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Bulk Share</DialogTitle>
          <DialogDescription>Send an on-chain bulk share proof for {count} files.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-4">
          <div className="p-3 rounded-md border bg-background/50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Files</div>
              <div className="font-mono text-sm">{count} selected</div>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">Estimated Fee</div>
            <div className="font-mono">{(Number(totalMicro) / 1_000_000).toFixed(6)} ALGO</div>
            <div className="mt-2 text-sm text-muted-foreground">Service</div>
            <div className="font-mono truncate max-w-full">{serviceAddr || 'Not configured'}</div>
          </div>

          <div>
            <Label htmlFor="recipient">Recipient Address</Label>
            <input id="recipient" className="w-full border p-2 rounded" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Algorand address" />
          </div>

          <div>
            <Label>Selected files</Label>
            <div className="max-h-56 overflow-auto border rounded p-2 bg-muted">
              {selectedFiles.map(f => (
                <div key={f._id} className="text-sm font-mono truncate">{f.filename} — {f.cid}</div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={loading || !recipient}>
            {loading ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>Processing...</> : `Send ${count} files`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
