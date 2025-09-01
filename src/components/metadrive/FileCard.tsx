"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { File, Share2 } from "lucide-react";
import type { FileMetadata } from "@/types";
import { formatBytes, truncateAddress } from "@/lib/utils";

interface FileCardProps {
  file: FileMetadata;
  onShare?: (file: FileMetadata) => void;
}

export default function FileCard({ file, onShare }: FileCardProps) {
  return (
    <Card className="flex flex-col justify-between transition-all hover:shadow-primary/20 hover:shadow-lg hover:-translate-y-1">
      <CardHeader>
        <div className="flex items-center gap-3">
            <File className="h-6 w-6 text-primary" />
            <CardTitle className="text-lg truncate font-sans">{file.filename}</CardTitle>
        </div>
        <CardDescription className="text-xs font-code pt-2">CID: {truncateAddress(file.cid, 6, 6)}</CardDescription>
      </CardHeader>
      <CardContent>
          <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
          { !onShare && (
              <p className="text-sm text-muted-foreground mt-1">From: {truncateAddress(file.owner)}</p>
          )}
      </CardContent>
      <CardFooter>
        {onShare && (
          <Button variant="secondary" className="w-full" onClick={() => onShare(file)}>
            <Share2 className="mr-2 h-4 w-4" /> Share
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
