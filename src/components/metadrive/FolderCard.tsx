
"use client";

import { Card, CardHeader } from "@/components/ui/card";
import { Folder } from "lucide-react";
import type { Folder as FolderType } from "@/types";
import { format } from "date-fns";

interface FolderCardProps {
  folder: FolderType;
  onFolderClick: (folder: FolderType) => void;
}

export default function FolderCard({ folder, onFolderClick }: FolderCardProps) {
  return (
    <Card 
      className="flex flex-col justify-between transition-all hover:shadow-primary/20 hover:shadow-lg hover:-translate-y-1 cursor-pointer"
      onClick={() => onFolderClick(folder)}
    >
      <CardHeader>
        <div className="flex items-center gap-3">
          <Folder className="h-8 w-8 text-amber-400" />
          <p className="text-lg font-semibold truncate">{folder.name}</p>
        </div>
      </CardHeader>
      <div className="p-6 pt-0">
          <p className="text-sm text-muted-foreground">Created: {format(new Date(folder.createdAt), "PPP")}</p>
      </div>
    </Card>
  );
}
