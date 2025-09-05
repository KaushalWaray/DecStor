
"use client";

import type { AlgorandAccount, FileMetadata, Folder } from '@/types';
import FileCard from './FileCard';
import FolderCard from './FolderCard';
import { Card, CardContent } from '../ui/card';
import { FileListView } from './FileListView';

interface FileGridProps {
  files: FileMetadata[];
  folders: Folder[];
  account: AlgorandAccount;
  pin: string;
  onSend: (file: FileMetadata) => void;
  onDetails: (file: FileMetadata) => void;
  onDelete: (item: FileMetadata | Folder) => void;
  onMove: (items: (FileMetadata | Folder)[]) => void;
  onRename: (item: FileMetadata | Folder) => void;
  onFolderClick: (folder: Folder) => void;
  emptyState: {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  };
  // New props for multi-select
  view: 'grid' | 'list';
  selectedItems: (FileMetadata | Folder)[];
  onSelectionChange: (item: FileMetadata | Folder, isSelected: boolean) => void;
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
    emptyState,
    view,
    selectedItems,
    onSelectionChange,
}: FileGridProps) {

  const isSelected = (item: FileMetadata | Folder) => {
    return selectedItems.some(selected => selected._id === item._id);
  }

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

  if (view === 'list') {
      return (
          <FileListView
              files={files}
              folders={folders}
              onFolderClick={onFolderClick}
              onSelectionChange={onSelectionChange}
              selectedItems={selectedItems}
              onSend={onSend}
              onRename={onRename}
              onMove={onMove}
              onDetails={onDetails}
              onDelete={onDelete}
          />
      );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-fade-in">
      {folders.map((folder) => (
        <FolderCard 
          key={folder._id}
          folder={folder}
          onFolderClick={onFolderClick}
          onDelete={() => onDelete(folder)}
          onRename={() => onRename(folder)}
          isSelected={isSelected(folder)}
          onSelectionChange={(checked) => onSelectionChange(folder, checked)}
        />
      ))}
      {files.map((file) => (
        <FileCard 
            key={file._id} 
            file={file} 
            pin={pin}
            isOwner={file.owner === account.addr}
            onSend={onSend}
            onDetails={onDetails}
            onDelete={() => onDelete(file)}
            onMove={() => onMove([file])}
            onRename={() => onRename(file)}
            isSelected={isSelected(file)}
            onSelectionChange={(checked) => onSelectionChange(file, checked)}
        />
      ))}
    </div>
  );
}
