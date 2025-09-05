
"use client";

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle, FileWarning } from 'lucide-react';
import type { FileMetadata } from '@/types';
import { IPFS_GATEWAY_URL } from '@/lib/constants';
import { decryptFile } from '@/lib/crypto';

interface MediaPreviewModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  file: FileMetadata;
  pin: string;
}

export default function MediaPreviewModal({ isOpen, onOpenChange, file, pin }: MediaPreviewModalProps) {
  const { toast } = useToast();
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isOpen) {
      const decryptAndSetUrl = async () => {
        setIsLoading(true);
        setError(null);
        setMediaUrl(null);

        try {
          toast({ title: "Fetching File...", description: "Downloading from IPFS." });
          const fileUrl = `${IPFS_GATEWAY_URL}/${file.cid}`;
          const response = await fetch(fileUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
          }
          const encryptedBlob = await response.blob();
          
          toast({ title: "Decrypting...", description: "Please wait, this may take a moment." });
          const decryptedFileBlob = await decryptFile(encryptedBlob, pin);

          // Use the correct MIME type for the Blob
          const typedBlob = new Blob([decryptedFileBlob], { type: file.fileType });

          const blobUrl = URL.createObjectURL(typedBlob);
          setMediaUrl(blobUrl);

        } catch (err: any) {
          console.error("Media preview failed:", err);
          const errorMessage = err.message || "Could not decrypt or load the media file.";
          toast({ variant: "destructive", title: "Preview Failed", description: errorMessage });
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };

      decryptAndSetUrl();
    } else {
      // Cleanup when modal closes
      if (mediaUrl) {
        URL.revokeObjectURL(mediaUrl);
        setMediaUrl(null);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, file.cid, pin]); // Rerun if the file or PIN changes while modal is open

  // Clean up the object URL when the component unmounts or the modal closes
  useEffect(() => {
    return () => {
      if (mediaUrl) {
        URL.revokeObjectURL(mediaUrl);
      }
    };
  }, [mediaUrl]);

  const renderPlayer = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Preparing preview...</p>
        </div>
      );
    }

    if (error) {
       return (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-center text-destructive">
          <FileWarning className="h-12 w-12" />
          <p className="font-semibold">Could not load media</p>
          <p className="text-sm">{error}</p>
        </div>
      );
    }
    
    if (mediaUrl) {
      if (file.fileType.startsWith('video/')) {
        return (
            <video ref={videoRef} src={mediaUrl} controls autoPlay className="w-full rounded-md max-h-[70vh] bg-black">
                Your browser does not support the video tag.
            </video>
        )
      }
      if (file.fileType.startsWith('audio/')) {
        return (
             <audio ref={audioRef} src={mediaUrl} controls autoPlay className="w-full">
                Your browser does not support the audio element.
            </audio>
        )
      }
    }

    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl truncate">{file.filename}</DialogTitle>
          <DialogDescription>
            Playing encrypted media file directly from your vault.
          </DialogDescription>
        </DialogHeader>
        <div className="my-4">
          {renderPlayer()}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
