"use client";

import type { FileMetadata } from '@/types';
import FileCard from './FileCard';

interface FileGridProps {
  files: FileMetadata[];
  onShare?: (file: FileMetadata) => void;
}

export default function FileGrid({ files, onShare }: FileGridProps) {
  if (files.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">No files here yet.</p>
        <p>{onShare ? "Upload a file to get started." : "Your inbox is empty."}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {files.map((file) => (
        <FileCard key={file.cid} file={file} onShare={onShare} />
      ))}
    </div>
  );
}
