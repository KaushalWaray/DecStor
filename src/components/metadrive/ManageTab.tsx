
"use client";

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AlgorandAccount, User } from "@/types";
import { BookUser, Send, Shield, Bell } from 'lucide-react';
import AddressBook from './AddressBook';
import SentFiles from './SentFiles';
import SecurityTab from './SecurityTab';
import NotificationsTab from './NotificationsTab';

interface ManageTabProps {
  account: AlgorandAccount;
  user: User;
  balance: number;
  onConfirmSendAlgo: (recipient: string, amount: number) => Promise<boolean>;
}

export default function ManageTab({ account, user, balance, onConfirmSendAlgo }: ManageTabProps) {
  
  return (
    <Tabs defaultValue="addressBook" className="w-full">
      <TabsList className="grid w-full grid-cols-4 max-w-2xl mx-auto">
        <TabsTrigger value="addressBook"><BookUser className="mr-2 h-4 w-4" />Address Book</TabsTrigger>
        <TabsTrigger value="sentFiles"><Send className="mr-2 h-4 w-4" />Sent Files</TabsTrigger>
        <TabsTrigger value="security"><Shield className="mr-2 h-4 w-4" />Security</TabsTrigger>
        <TabsTrigger value="notifications"><Bell className="mr-2 h-4 w-4" />Notifications</TabsTrigger>
      </TabsList>
      <TabsContent value="addressBook" className="mt-6">
        <AddressBook account={account} balance={balance} onConfirmSendAlgo={onConfirmSendAlgo} />
      </TabsContent>
      <TabsContent value="sentFiles" className="mt-6">
        <SentFiles account={account} />
      </TabsContent>
      <TabsContent value="security" className="mt-6">
        <SecurityTab account={account} user={user} />
      </TabsContent>
       <TabsContent value="notifications" className="mt-6">
        <NotificationsTab account={account} user={user} />
      </TabsContent>
    </Tabs>
  );
}
