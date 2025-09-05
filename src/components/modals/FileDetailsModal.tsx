
"use client";

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { FileText, Copy, AlertTriangle } from 'lucide-react';
import type { FileMetadata } from '@/types';
import { formatBytes, truncateAddress } from '@/lib/utils';
import { format } from 'date-fns';

interface FileDetailsModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  file: FileMetadata;
}

export default function FileDetailsModal({ isOpen, onOpenChange, file }: FileDetailsModalProps) {
  const { toast } = useToast();

  const handleCopy = (text: string) => {
      navigator.clipboard.writeText(text);
      toast({ title: "Copied to clipboard!" });
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2">
            <FileText /> File Details
          </DialogTitle>
          <DialogDescription>
            Detailed information for the selected file.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 my-4">
            <DetailRow label="Filename" value={file.filename} />
            <DetailRow label="File Size" value={formatBytes(file.size)} />
            <DetailRow label="File Type" value={file.fileType || 'Unknown'} />
            <DetailRow label="Uploaded" value={format(new Date(file.createdAt), "PPP p")} />
            <DetailRow label="Owner" value={file.owner} onCopy={handleCopy} isCode={true} />
            <DetailRow label="IPFS CID" value={file.cid} onCopy={handleCopy} isCode={true} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface DetailRowProps {
    label: string;
    value: string;
    onCopy?: (value: string) => void;
    isCode?: boolean;
}

const DetailRow = ({ label, value, onCopy, isCode }: DetailRowProps) => (
    <div className="space-y-1">
        <Label className="text-muted-foreground">{label}</Label>
        <div className="relative">
            <Input 
                value={value} 
                readOnly 
                className={`pr-10 ${isCode ? 'font-code text-sm' : ''}`} 
            />
            {onCopy && (
                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => onCopy(value)}>
                    <Copy className="h-4 w-4" />
                </Button>
            )}
        </div>
    </div>
);
