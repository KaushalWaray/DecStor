
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MyVault from "./MyVault";
import Inbox from "./Inbox";
import type { AlgorandAccount, FileMetadata } from "@/types";
import ActivityLog from "./ActivityLog";
import { getNotifications } from '@/lib/api';
import { Bell, BookUser, HardDrive, Inbox as InboxIcon, Settings } from 'lucide-react';
import ManageTab from './ManageTab';

interface FileTabsProps {
  account: AlgorandAccount;
  pin: string;
  onConfirmSendFile: (file: FileMetadata, recipient: string) => Promise<boolean>;
  onConfirmSendAlgo: (recipient: string, amount: number) => Promise<boolean>;
}

export default function FileTabs({ account, pin, onConfirmSendFile, onConfirmSendAlgo }: FileTabsProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentTab, setCurrentTab] = useState("vault");

  const fetchUnreadCount = useCallback(async () => {
    try {
      const { activities } = await getNotifications(account.addr);
      const count = activities.filter(a => !a.isRead).length;
      setUnreadCount(count);
    } catch (error) {
      console.error("Failed to fetch unread notifications count", error);
    }
  }, [account.addr]);

  useEffect(() => {
    fetchUnreadCount();
    // Optional: Poll for new notifications periodically
    const interval = setInterval(fetchUnreadCount, 30000); // every 30 seconds
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const onNotificationsViewed = () => {
    setUnreadCount(0);
    fetchUnreadCount(); // Refetch to be sure
  };

  return (
    <Tabs defaultValue="vault" className="w-full" onValueChange={setCurrentTab}>
      <TabsList className="grid w-full grid-cols-4 max-w-2xl mx-auto">
        <TabsTrigger value="vault"><HardDrive className="w-4 h-4 mr-2" />My Vault</TabsTrigger>
        <TabsTrigger value="inbox"><InboxIcon className="w-4 h-4 mr-2" />Inbox</TabsTrigger>
         <TabsTrigger value="manage"><Settings className="w-4 h-4 mr-2" />Manage</TabsTrigger>
        <TabsTrigger value="notifications">
            <div className="relative flex items-center gap-2">
                <Bell className="h-4 w-4"/>
                Activity
                {unreadCount > 0 && (
                    <span className="absolute top-[-5px] right-[-15px] flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                        {unreadCount}
                    </span>
                )}
            </div>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="vault" className="mt-6">
        <MyVault account={account} pin={pin} onConfirmSendFile={onConfirmSendFile} />
      </TabsContent>
      <TabsContent value="inbox" className="mt-6">
        <Inbox account={account} pin={pin} />
      </TabsContent>
      <TabsContent value="manage" className="mt-6">
        <ManageTab account={account} onConfirmSendAlgo={onConfirmSendAlgo} />
      </TabsContent>
       <TabsContent value="notifications" className="mt-6">
        <ActivityLog
            account={account}
            onLogsViewed={onNotificationsViewed}
            isTabActive={currentTab === 'notifications'}
        />
      </TabsContent>
    </Tabs>
  );
}
