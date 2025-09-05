
"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { File, Share2, Download, MoreVertical, Info, Trash2, LoaderCircle, ArrowRight, Edit, Send, Play } from "lucide-react";
import type { FileMetadata } from "@/types";
import { formatBytes, truncateAddress } from "@/lib/utils";
import { IPFS_GATEWAY_URL } from "@/lib/constants";
import { decryptFile } from "@/lib/crypto";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Checkbox } from "../ui/checkbox";
import { cn } from "@/lib/utils";

interface FileCardProps {
  file: FileMetadata;
  pin: string;
  isOwner: boolean;
  onSend: (file: FileMetadata) => void;
  onDetails: (file: FileMetadata) => void;
  onDelete: (file: FileMetadata) => void;
  onMove: (file: FileMetadata) => void;
  onRename: (file: FileMetadata) => void;
  onPreview: (file: FileMetadata) => void;
  isSelected: boolean;
  onSelectionChange: (checked: boolean) => void;
}

export default function FileCard({ file, pin, isOwner, onSend, onDetails, onDelete, onMove, onRename, onPreview, isSelected, onSelectionChange }: FileCardProps) {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);

  const isPreviewable = file.fileType.startsWith('audio/') || file.fileType.startsWith('video/');

  const handleDownload = async () => {
    setIsDownloading(true);
    toast({ title: "Downloading & Decrypting...", description: "Please wait while we prepare your file." });
    try {
      const fileUrl = `${IPFS_GATEWAY_URL}/${file.cid}`;
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
      }
      const encryptedBlob = await response.blob();
      
      const decryptedFile = await decryptFile(encryptedBlob, pin);

      // Create a URL for the decrypted blob and trigger download
      const blobUrl = URL.createObjectURL(decryptedFile);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = file.filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(blobUrl);

      toast({ title: "Download complete!", description: `${file.filename} has been downloaded.` });
    } catch(error: any) {
        console.error("Download failed:", error);
        toast({ variant: "destructive", title: "Download Failed", description: error.message || "Could not download and decrypt the file." });
    } finally {
        setIsDownloading(false);
    }
  };


  return (
    <Card className={cn(
      "flex flex-col justify-between transition-all hover:shadow-primary/20 hover:shadow-lg hover:-translate-y-1 relative",
      isSelected && "ring-2 ring-primary shadow-primary/20"
      )}>
        <div className="absolute top-2 left-2 z-10">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelectionChange}
              aria-label={`Select file ${file.filename}`}
              className="bg-background/80"
            />
        </div>
      <CardHeader className="pt-8">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
              <File className="h-6 w-6 text-primary flex-shrink-0" />
              <CardTitle className="text-lg truncate font-sans">{file.filename}</CardTitle>
          </div>
          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isPreviewable && (
                  <DropdownMenuItem onClick={() => onPreview(file)}>
                    <Play className="mr-2 h-4 w-4" /> Preview
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onSend(file)}>
                  <Send className="mr-2 h-4 w-4" /> Send
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onRename(file)}>
                  <Edit className="mr-2 h-4 w-4" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMove(file)}>
                  <ArrowRight className="mr-2 h-4 w-4" /> Move
                </DropdownMenuItem>
                 <DropdownMenuItem onClick={() => onDetails(file)}>
                  <Info className="mr-2 h-4 w-4" /> Details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(file)} className="text-destructive focus:text-destructive-foreground focus:bg-destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <CardDescription className="text-xs font-code pt-2">CID: {truncateAddress(file.cid, 6, 6)}</CardDescription>
      </CardHeader>
      <CardContent>
          <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
          { !isOwner && (
              <p className="text-sm text-muted-foreground mt-1">From: {truncateAddress(file.owner)}</p>
          )}
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" className="w-full flex-1" onClick={handleDownload} disabled={isDownloading}>
          {isDownloading ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
           Download
        </Button>
        {isPreviewable && (
          <Button variant="secondary" onClick={() => onPreview(file)} className="w-full flex-1">
            <Play className="mr-2 h-4 w-4" /> Preview
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
