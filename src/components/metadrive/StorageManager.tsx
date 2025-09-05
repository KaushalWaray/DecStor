
"use client";

import type { StorageInfo } from "@/types";
import { formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { HardDrive, Zap } from "lucide-react";
import { UPGRADE_COST_ALGOS } from "@/lib/constants";

interface StorageManagerProps {
  storageInfo: StorageInfo;
  onUpgrade: () => void;
  isUpgrading: boolean;
}

export default function StorageManager({ storageInfo, onUpgrade, isUpgrading }: StorageManagerProps) {
  const { storageUsed, storageLimit } = storageInfo;
  const usagePercentage = storageLimit > 0 ? (storageUsed / storageLimit) * 100 : 0;
  const isPro = storageLimit > 1024 * 1024; // If limit is > 1MB, assume they are Pro

  return (
    <Card className="bg-secondary/50 border-accent/20">
      <CardHeader>
        <div className="flex items-center gap-3">
          <HardDrive className="h-6 w-6 text-accent" />
          <CardTitle className="font-headline text-2xl text-accent">Your Storage</CardTitle>
        </div>
        <CardDescription>
          This is your current decentralized storage usage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-1 text-sm">
            <span className="text-muted-foreground">{formatBytes(storageUsed)} used</span>
            <span className="font-semibold">{formatBytes(storageLimit)}</span>
          </div>
          <Progress value={usagePercentage} className="h-2" />
        </div>
        {!isPro && (
          <div className="flex items-center justify-between p-3 bg-background rounded-md">
            <p className="text-sm">Upgrade to get 100MB of storage.</p>
            <Button onClick={onUpgrade} disabled={isUpgrading}>
              <Zap className="mr-2 h-4 w-4" />
              Upgrade for {UPGRADE_COST_ALGOS} ALGO
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
