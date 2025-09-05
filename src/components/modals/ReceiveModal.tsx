
"use client";

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
import { Copy, QrCode } from 'lucide-react';
import QRCode from 'qrcode.react';

interface ReceiveModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  address: string;
}

export default function ReceiveModal({ isOpen, onOpenChange, address }: ReceiveModalProps) {
  const { toast } = useToast();

  const handleCopy = () => {
      navigator.clipboard.writeText(address);
      toast({ title: "Address copied to clipboard!" });
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2">
            <QrCode /> Receive Files & Assets
          </DialogTitle>
          <DialogDescription>
            Share your address with others to receive files or Algorand assets.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 my-4 flex flex-col items-center">
            <div className="p-4 bg-white rounded-lg">
                <QRCode value={address} size={256} level="H" />
            </div>
            <div className="space-y-1 w-full">
                <Label htmlFor="receive-address">Your Algorand Address</Label>
                <div className="relative">
                    <Input 
                        id="receive-address"
                        value={address} 
                        readOnly 
                        className="pr-10 font-code text-sm"
                    />
                    <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={handleCopy}>
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
        <DialogFooter>
            <Button onClick={() => onOpenChange(false)} className="w-full">Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
