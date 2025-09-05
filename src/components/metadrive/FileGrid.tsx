
"use client";

import type { AlgorandAccount, FileMetadata } from '@/types';
import FileCard from './FileCard';
import { FileSearch } from 'lucide-react';
import { Card, CardContent } from '../ui/card';

interface FileGridProps {
  files: FileMetadata[];
  account: AlgorandAccount;
  onShare: (file: FileMetadata) => void;
  onDetails: (file: FileMetadata) => void;
  onDelete: (file: FileMetadata) => void;
  emptyState: {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  };
}

export default function FileGrid({ files, account, onShare, onDetails, onDelete, emptyState }: FileGridProps) {
  if (files.length === 0) {
    const Icon = emptyState.icon;
    return (
        <Card className="flex items-center justify-center h-64 border-dashed">
            <CardContent className="text-center text-muted-foreground pt-6">
                <Icon className="mx-auto h-12 w-12 mb-4" />
                <h3 className="text-xl font-semibold text-foreground">{emptyState.title}</h3>
                <p>{emptyState.description}</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-fade-in">
      {files.map((file) => (
        <FileCard 
            key={file.cid} 
            file={file} 
            isOwner={file.owner === account.addr}
            onShare={onShare}
            onDetails={onDetails}
            onDelete={onDelete}
        />
      ))}
    </div>
  );
}
