
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { getContacts, createContact, updateContact, deleteContact } from '@/lib/api';
import { truncateAddress } from '@/lib/utils';
import type { AlgorandAccount, Contact } from '@/types';
import { LoaderCircle, BookUser, PlusCircle, MoreVertical, Edit, Trash2, Send, Copy, AlertTriangle } from 'lucide-react';
import EditContactModal from '../modals/EditContactModal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import SendModal from '../modals/SendModal';
import ApproveTransactionModal from '../modals/ApproveTransactionModal';

interface AddressBookProps {
    account: AlgorandAccount;
    balance: number;
    onConfirmSendAlgo: (recipient: string, amount: number) => Promise<boolean>;
}

export default function AddressBook({ account, balance, onConfirmSendAlgo }: AddressBookProps) {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
    
    // State for sending ALGO
    const [isSendModalOpen, setIsSendModalOpen] = useState(false);
    const [isApproveSendModalOpen, setIsApproveSendModalOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [sendDetails, setSendDetails] = useState<{recipient: string, amount: number} | null>(null);


    const { toast } = useToast();

    const fetchContacts = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await getContacts(account.addr);
            setContacts(response.contacts);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsLoading(false);
        }
    }, [account.addr, toast]);

    useEffect(() => {
        fetchContacts();
    }, [fetchContacts]);

    const handleSaveContact = async (name: string, address: string) => {
        try {
            if (editingContact) {
                // Update existing contact
                await updateContact(editingContact._id, { owner: account.addr, name, address });
                toast({ title: 'Contact Updated', description: `Successfully updated ${name}.` });
            } else {
                // Create new contact
                await createContact({ owner: account.addr, name, address });
                toast({ title: 'Contact Added', description: `${name} has been added to your address book.` });
            }
            fetchContacts(); // Refresh list
            return true;
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
            return false;
        }
    };

    const handleDeleteContact = async () => {
        if (!contactToDelete) return;
        try {
            await deleteContact(contactToDelete._id, account.addr);
            toast({ title: 'Contact Deleted' });
            fetchContacts();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Delete Failed', description: error.message });
        } finally {
            setContactToDelete(null);
        }
    };

    const handleInitiateSend = (recipient: string, amount: number) => {
        setSendDetails({ recipient, amount });
        setIsSendModalOpen(false);
        setIsApproveSendModalOpen(true);
    };

    const handleConfirmSend = async () => {
        if (!sendDetails) return;
        setIsSending(true);
        const success = await onConfirmSendAlgo(sendDetails.recipient, sendDetails.amount);
        setIsSending(false);
        if(success) {
            setIsApproveSendModalOpen(false);
            setSendDetails(null);
        }
    };

    const openSendModalForContact = (contact: Contact) => {
        setSendDetails({recipient: contact.address, amount: 0});
        setIsSendModalOpen(true);
    };
    
    return (
        <>
            <Card className="max-w-4xl mx-auto">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="font-headline text-2xl flex items-center gap-2"><BookUser /> Address Book</CardTitle>
                        <CardDescription>Manage your saved Algorand addresses.</CardDescription>
                    </div>
                    <Button onClick={() => { setEditingContact(null); setIsModalOpen(true); }}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Contact
                    </Button>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-40"><LoaderCircle className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : contacts.length === 0 ? (
                        <div className="text-center text-muted-foreground py-10">
                            <p>Your address book is empty.</p>
                            <p className="text-sm">Add a contact to get started.</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-border">
                            {contacts.map((contact) => (
                                <li key={contact._id} className="flex items-center justify-between p-3">
                                    <div>
                                        <p className="font-semibold">{contact.name}</p>
                                        <p className="text-sm text-muted-foreground font-code">{truncateAddress(contact.address)}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={() => openSendModalForContact(contact)}>
                                            <Send className="mr-2" /> Send ALGO
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical /></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => { setEditingContact(contact); setIsModalOpen(true); }}>
                                                    <Edit className="mr-2" /> Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(contact.address); toast({title: "Address Copied!"})}}>
                                                    <Copy className="mr-2" /> Copy Address
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-destructive" onClick={() => setContactToDelete(contact)}>
                                                    <Trash2 className="mr-2" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>

            <EditContactModal
                isOpen={isModalOpen}
                onOpenChange={setIsModalOpen}
                onConfirm={handleSaveContact}
                contact={editingContact}
            />
            
            {contactToDelete && (
                <AlertDialog open={!!contactToDelete} onOpenChange={(open) => !open && setContactToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive" />Delete Contact?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete the contact <span className="font-bold text-foreground">{contactToDelete.name}</span>? This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteContact} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}

            {isSendModalOpen && sendDetails && (
                <SendModal 
                    isOpen={isSendModalOpen}
                    onOpenChange={setIsSendModalOpen}
                    onConfirm={handleInitiateSend}
                    isLoading={isSending}
                    balance={balance}
                    account={account}
                    initialRecipient={sendDetails.recipient}
                />
            )}

            {sendDetails && (
                <ApproveTransactionModal
                    isOpen={isApproveSendModalOpen}
                    onOpenChange={setIsApproveSendModalOpen}
                    onApprove={handleConfirmSend}
                    isLoading={isSending}
                    title="Approve Transaction"
                    description="You are about to send ALGO to another wallet. Please review the details carefully."
                    actionText={`Send ${sendDetails.amount} ALGO`}
                    recipientAddress={sendDetails.recipient}
                    amount={sendDetails.amount}
                />
            )}

        </>
    );
}
