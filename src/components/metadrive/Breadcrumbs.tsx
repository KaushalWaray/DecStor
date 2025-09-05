
"use client";

import { Button } from "@/components/ui/button";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbsProps {
  path: string;
  onPathChange: (newPath: string) => void;
}

export default function Breadcrumbs({ path, onPathChange }: BreadcrumbsProps) {
  const parts = path.split('/').filter(Boolean); // Split and remove empty strings

  const handleCrumbClick = (index: number) => {
    if (index === -1) {
      onPathChange('/');
      return;
    }
    const newPath = `/${parts.slice(0, index + 1).join('/')}/`;
    onPathChange(newPath);
  };

  return (
    <nav className="flex items-center gap-1 text-sm font-medium">
      <Button variant="ghost" size="sm" onClick={() => handleCrumbClick(-1)} className="flex items-center gap-2">
        <Home className="h-4 w-4" />
        My Vault
      </Button>

      {parts.map((part, index) => (
        <div key={index} className="flex items-center gap-1">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleCrumbClick(index)}
            className={`
              ${index === parts.length - 1 ? 'text-foreground font-semibold' : 'text-muted-foreground'}
            `}
          >
            {part}
          </Button>
        </div>
      ))}
    </nav>
  );
}
