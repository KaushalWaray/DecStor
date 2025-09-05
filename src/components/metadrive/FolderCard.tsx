
"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Folder, MoreVertical, Trash2, Edit, FolderLock, ArrowRight } from "lucide-react";
import type { Folder as FolderType } from "@/types";
import { format } from "date-fns";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { cn } from "@/lib/utils";


interface FolderCardProps {
  folder: FolderType;
  onFolderClick: (folder: FolderType) => void;
  onDelete: (folder: FolderType) => void;
  onRename: (folder: FolderType) => void;
  onMove: (folder: FolderType) => void;
  isSelected: boolean;
  onSelectionChange: (checked: boolean) => void;
}

export default function FolderCard({ folder, onFolderClick, onDelete, onRename, onMove, isSelected, onSelectionChange }: FolderCardProps) {
  const Icon = folder.isLocked ? FolderLock : Folder;

  return (
    <Card 
      className={cn(
        "flex flex-col justify-between transition-all hover:shadow-primary/20 hover:shadow-lg hover:-translate-y-1 group relative",
        isSelected && "ring-2 ring-primary shadow-primary/20"
      )}
      onDoubleClick={() => onFolderClick(folder)}
    >
      <div className="absolute top-2 left-2 z-10">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelectionChange}
          aria-label={`Select folder ${folder.name}`}
          className="bg-background/80"
        />
      </div>
      <CardHeader className="pt-8">
        <div className="flex items-start justify-between gap-3">
          <div 
            className="flex items-center gap-3 min-w-0 cursor-pointer"
            onClick={() => onFolderClick(folder)}
          >
            <Icon className={`h-8 w-8 ${folder.isLocked ? 'text-red-400' : 'text-amber-400'} flex-shrink-0`} />
            <p className="text-lg font-semibold truncate">{folder.name}</p>
          </div>
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onRename(folder)}>
                <Edit className="mr-2 h-4 w-4" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMove(folder)}>
                <ArrowRight className="mr-2 h-4 w-4" /> Move
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDelete(folder)} className="text-destructive focus:text-destructive-foreground focus:bg-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent 
        className="cursor-pointer"
        onClick={() => onFolderClick(folder)}
      >
        <p className="text-sm text-muted-foreground">Created: {format(new Date(folder.createdAt), "PPP")}</p>
      </CardContent>
    </Card>
  );
}
