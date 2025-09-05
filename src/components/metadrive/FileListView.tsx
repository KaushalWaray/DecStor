
"use client";

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Folder, File, MoreVertical, Edit, Trash2, ArrowRight, Send, Info, FolderLock, Download, LoaderCircle } from "lucide-react";
import { format } from "date-fns";
import { formatBytes } from "@/lib/utils";
import type { FileMetadata, Folder as FolderType } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { IPFS_GATEWAY_URL } from "@/lib/constants";
import { decryptFile } from "@/lib/crypto";

interface FileListViewProps {
  folders: FolderType[];
  files: FileMetadata[];
  pin: string;
  onFolderClick: (folder: FolderType) => void;
  selectedItems: (FileMetadata | FolderType)[];
  onSelectionChange: (item: FileMetadata | FolderType, selected: boolean) => void;
  onSend: (file: FileMetadata) => void;
  onRename: (item: FileMetadata | FolderType) => void;
  onMove: (items: (FileMetadata | FolderType)[]) => void;
  onDetails: (file: FileMetadata) => void;
  onDelete: (item: FileMetadata | FolderType) => void;
}

export function FileListView({
  folders,
  files,
  pin,
  onFolderClick,
  selectedItems,
  onSelectionChange,
  onSend,
  onRename,
  onMove,
  onDetails,
  onDelete
}: FileListViewProps) {
  const { toast } = useToast();
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);

  const allItems = [...folders, ...files];

  const isSelected = (itemId: string) => {
    return selectedItems.some(item => item._id === itemId);
  }

  const handleSelectAll = (checked: boolean) => {
      allItems.forEach(item => onSelectionChange(item, checked));
  }

  const handleDownload = async (file: FileMetadata) => {
    setDownloadingFileId(file._id);
    toast({ title: "Downloading & Decrypting...", description: "Please wait while we prepare your file." });
    try {
      const fileUrl = `${IPFS_GATEWAY_URL}/${file.cid}`;
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
      }
      const encryptedBlob = await response.blob();
      const decryptedFile = await decryptFile(encryptedBlob, pin);

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
        setDownloadingFileId(null);
    }
  };

  const isAllSelected = allItems.length > 0 && selectedItems.length === allItems.length;

  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox 
                checked={isAllSelected}
                onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                aria-label="Select all items"
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="hidden md:table-cell">Date Modified</TableHead>
            <TableHead className="text-right hidden md:table-cell">File Size</TableHead>
            <TableHead className="w-[100px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {folders.map(folder => {
            const Icon = folder.isLocked ? FolderLock : Folder;
            return (
                <TableRow key={folder._id} onDoubleClick={() => onFolderClick(folder)} className="cursor-pointer">
                    <TableCell>
                        <Checkbox 
                            checked={isSelected(folder._id)}
                            onCheckedChange={(checked) => onSelectionChange(folder, Boolean(checked))}
                            aria-label={`Select folder ${folder.name}`}
                        />
                    </TableCell>
                    <TableCell className="font-medium" onClick={() => onFolderClick(folder)}>
                        <div className="flex items-center gap-2">
                           <Icon className={`h-5 w-5 ${folder.isLocked ? 'text-red-400' : 'text-amber-400'} flex-shrink-0`} />
                           {folder.name}
                        </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell" onClick={() => onFolderClick(folder)}>
                        {format(new Date(folder.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell" onClick={() => onFolderClick(folder)}>--</TableCell>
                    <TableCell className="text-right">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreVertical /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onRename(folder)}><Edit className="mr-2"/> Rename</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onMove([folder])}><ArrowRight className="mr-2"/> Move</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => onDelete(folder)} className="text-destructive"><Trash2 className="mr-2"/> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                </TableRow>
            );
          })}
          {files.map(file => (
            <TableRow key={file._id}>
                <TableCell>
                    <Checkbox 
                        checked={isSelected(file._id)}
                        onCheckedChange={(checked) => onSelectionChange(file, Boolean(checked))}
                        aria-label={`Select file ${file.filename}`}
                    />
                </TableCell>
                <TableCell className="font-medium">
                     <div className="flex items-center gap-2">
                        <File className="h-5 w-5 text-primary flex-shrink-0" />
                        {file.filename}
                    </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">{format(new Date(file.createdAt), "MMM d, yyyy")}</TableCell>
                <TableCell className="text-right hidden md:table-cell">{formatBytes(file.size)}</TableCell>
                 <TableCell className="text-right">
                     <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDownload(file)}
                        disabled={downloadingFileId === file._id}
                     >
                        {downloadingFileId === file._id ? <LoaderCircle className="animate-spin" /> : <Download />}
                     </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreVertical /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onSend(file)}><Send className="mr-2"/> Send</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onRename(file)}><Edit className="mr-2"/> Rename</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onMove([file])}><ArrowRight className="mr-2"/> Move</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDetails(file)}><Info className="mr-2"/> Details</DropdownMenuItem>
                             <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onDelete(file)} className="text-destructive"><Trash2 className="mr-2"/> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
