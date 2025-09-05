
"use client";

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AlgorandAccount } from "@/types";
import { BookUser, Send } from 'lucide-react';
import AddressBook from './AddressBook';
import SentFiles from './SentFiles';

interface ManageTabProps {
  account: AlgorandAccount;
  balance: number;
  onConfirmSendAlgo: (recipient: string, amount: number) => Promise<boolean>;
}

export default function ManageTab({ account, balance, onConfirmSendAlgo }: ManageTabProps) {
  
  return (
    <Tabs defaultValue="addressBook" className="w-full">
      <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
        <TabsTrigger value="addressBook"><BookUser className="mr-2 h-4 w-4" />Address Book</TabsTrigger>
        <TabsTrigger value="sentFiles"><Send className="mr-2 h-4 w-4" />Sent Files</TabsTrigger>
      </TabsList>
      <TabsContent value="addressBook" className="mt-6">
        <AddressBook account={account} balance={balance} onConfirmSendAlgo={onConfirmSendAlgo} />
      </TabsContent>
      <TabsContent value="sentFiles" className="mt-6">
        <SentFiles account={account} />
      </TabsContent>
    </Tabs>
  );
}
