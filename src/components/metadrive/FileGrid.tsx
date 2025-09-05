
"use client";

import type { AlgorandAccount, FileMetadata, Folder } from '@/types';
import FileCard from './FileCard';
import FolderCard from './FolderCard';
import { Card, CardContent } from '../ui/card';

interface FileGridProps {
  files: FileMetadata[];
  folders: Folder[];
  account: AlgorandAccount;
  pin: string;
  onSend: (file: FileMetadata) => void;
  onDetails: (file: FileMetadata) => void;
  onDelete: (file: FileMetadata) => void;
  onMove: (file: FileMetadata) => void;
  onRename: (item: FileMetadata | Folder) => void;
  onFolderClick: (folder: Folder) => void;
  onFolderDelete: (folder: Folder) => void;
  emptyState: {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  };
}

export default function FileGrid({ 
    files = [], 
    folders = [], 
    account, 
    pin, 
    onSend, 
    onDetails, 
    onDelete, 
    onMove,
    onRename,
    onFolderClick, 
    onFolderDelete,
    emptyState 
}: FileGridProps) {
  if (files.length === 0 && folders.length === 0) {
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
      {folders.map((folder) => (
        <FolderCard 
          key={folder._id}
          folder={folder}
          onFolderClick={onFolderClick}
          onDelete={onFolderDelete}
          onRename={() => onRename(folder)}
        />
      ))}
      {files.map((file) => (
        <FileCard 
            key={file.cid} 
            file={file} 
            pin={pin}
            isOwner={file.owner === account.addr}
            onSend={onSend}
            onDetails={onDetails}
            onDelete={onDelete}
            onMove={onMove}
            onRename={() => onRename(file)}
        />
      ))}
    </div>
  );
}
