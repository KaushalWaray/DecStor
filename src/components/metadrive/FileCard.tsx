
"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { File, Share2, Download, MoreVertical, Info, Trash2 } from "lucide-react";
import type { FileMetadata } from "@/types";
import { formatBytes, truncateAddress } from "@/lib/utils";
import { IPFS_GATEWAY_URL } from "@/lib/constants";

interface FileCardProps {
  file: FileMetadata;
  isOwner: boolean;
  onShare: (file: FileMetadata) => void;
  onDetails: (file: FileMetadata) => void;
  onDelete: (file: FileMetadata) => void;
}

export default function FileCard({ file, isOwner, onShare, onDetails, onDelete }: FileCardProps) {

  const handleDownload = () => {
    const fileUrl = `${IPFS_GATEWAY_URL}/${file.cid}`;
    window.open(fileUrl, '_blank');
  };

  return (
    <Card className="flex flex-col justify-between transition-all hover:shadow-primary/20 hover:shadow-lg hover:-translate-y-1">
      <CardHeader>
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
                <DropdownMenuItem onClick={() => onShare(file)}>
                  <Share2 className="mr-2 h-4 w-4" /> Share
                </DropdownMenuItem>
                 <DropdownMenuItem onClick={() => onDetails(file)}>
                  <Info className="mr-2 h-4 w-4" /> Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(file)} className="text-destructive">
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
      <CardFooter>
        <Button variant="outline" className="w-full" onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" /> Download
        </Button>
      </CardFooter>
    </Card>
  );
}
