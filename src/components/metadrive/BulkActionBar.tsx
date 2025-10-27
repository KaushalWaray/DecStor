
"use client";

import { Button } from "@/components/ui/button";
import { Move, Trash2, XCircle, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkActionBarProps {
  selectedItemCount: number;
  onMove: () => void;
  onDelete: () => void;
  onBulkShare?: () => void;
  onClear: () => void;
}

export default function BulkActionBar({ selectedItemCount, onMove, onDelete, onBulkShare, onClear }: BulkActionBarProps) {
  const isVisible = selectedItemCount > 0;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-20 transition-all duration-300",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-16 pointer-events-none"
      )}
    >
      <div className="flex items-center gap-4 p-3 bg-card border rounded-lg shadow-2xl">
        <p className="text-sm font-semibold w-24 text-center">
          {selectedItemCount} selected
        </p>
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onMove}>
                <Move className="mr-2 h-4 w-4" /> Move
            </Button>
      <Button variant="secondary" onClick={onBulkShare}>
        <UserPlus className="mr-2 h-4 w-4" /> Share
      </Button>
            <Button variant="destructive" onClick={onDelete}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
        </div>
        <Button variant="ghost" size="icon" onClick={onClear}>
            <XCircle />
        </Button>
      </div>
    </div>
  );
}
