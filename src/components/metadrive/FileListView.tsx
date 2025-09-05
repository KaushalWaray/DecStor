
"use client";

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Folder, File, MoreVertical, Edit, Trash2, ArrowRight, Send, Info, FolderLock } from "lucide-react";
import { format } from "date-fns";
import { formatBytes } from "@/lib/utils";
import type { FileMetadata, Folder as FolderType } from "@/types";

interface FileListViewProps {
  folders: FolderType[];
  files: FileMetadata[];
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
  onFolderClick,
  selectedItems,
  onSelectionChange,
  onSend,
  onRename,
  onMove,
  onDetails,
  onDelete
}: FileListViewProps) {

  const allItems = [...folders, ...files];

  const isSelected = (itemId: string) => {
    return selectedItems.some(item => item._id === itemId);
  }

  const handleSelectAll = (checked: boolean) => {
      allItems.forEach(item => onSelectionChange(item, checked));
  }

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
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="hidden md:table-cell">Date Modified</TableHead>
            <TableHead className="text-right hidden md:table-cell">File Size</TableHead>
            <TableHead className="w-[50px]"></TableHead>
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
                    <TableCell>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreVertical /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
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
                 <TableCell>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreVertical /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
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
