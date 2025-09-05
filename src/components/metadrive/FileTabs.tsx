
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MyVault from "./MyVault";
import Inbox from "./Inbox";
import type { AlgorandAccount } from "@/types";

interface FileTabsProps {
  account: AlgorandAccount;
  pin: string;
}

export default function FileTabs({ account, pin }: FileTabsProps) {
  return (
    <Tabs defaultValue="vault" className="w-full">
      <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
        <TabsTrigger value="vault">My Vault</TabsTrigger>
        <TabsTrigger value="inbox">Inbox</TabsTrigger>
      </TabsList>
      <TabsContent value="vault">
        <MyVault account={account} pin={pin} />
      </TabsContent>
      <TabsContent value="inbox">
        <Inbox account={account} pin={pin} />
      </TabsContent>
    </Tabs>
  );
}
