
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MyVault from "./MyVault";
import Inbox from "./Inbox";
import type { AlgorandAccount, FileMetadata } from "@/types";
import ActivityLog from "./ActivityLog";

interface FileTabsProps {
  account: AlgorandAccount;
  pin: string;
  onConfirmSendFile: (file: FileMetadata, recipient: string) => Promise<boolean>;
}

export default function FileTabs({ account, pin, onConfirmSendFile }: FileTabsProps) {
  return (
    <Tabs defaultValue="vault" className="w-full">
      <TabsList className="grid w-full grid-cols-3 max-w-lg mx-auto">
        <TabsTrigger value="vault">My Vault</TabsTrigger>
        <TabsTrigger value="inbox">Inbox</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>
      <TabsContent value="vault">
        <MyVault account={account} pin={pin} onConfirmSendFile={onConfirmSendFile} />
      </TabsContent>
      <TabsContent value="inbox">
        <Inbox account={account} pin={pin} />
      </TabsContent>
       <TabsContent value="activity">
        <ActivityLog account={account} />
      </TabsContent>
    </Tabs>
  );
}
