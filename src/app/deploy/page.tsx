
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle, Copy } from 'lucide-react';
import { ALGOD_SERVER, ALGOD_PORT, ALGOD_TOKEN } from '@/lib/constants';
import algosdk from 'algosdk';
import { mnemonicToAccount } from '@/lib/algorand';

// --- Pre-compiled TEAL Programs ---
// This is a simple, standard "messenger" contract that allows for on-chain messages.
// It approves any ApplicationCall transaction that has application arguments.
// This is perfect for our use case of logging a share event.
const APPROVAL_PROGRAM = `#pragma version 6
txn NumAppArgs
int 0
>
assert
int 1
return`;

const CLEAR_STATE_PROGRAM = `#pragma version 6
int 1
return`;
// --- End of TEAL Programs ---

const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);

export default function DeployContractPage() {
  const [mnemonic, setMnemonic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [appId, setAppId] = useState<number | null>(null);
  const [txId, setTxId] = useState<string | null>(null);
  const { toast } = useToast();

  const compileProgram = async (source: string) => {
    const compiled = await algodClient.compile(source).do();
    return new Uint8Array(Buffer.from(compiled.result, 'base64'));
  };

  const handleDeploy = async () => {
    if (!mnemonic.trim() || mnemonic.split(' ').length !== 25) {
      toast({ variant: 'destructive', title: 'Invalid Mnemonic', description: 'Please enter your valid 25-word mnemonic phrase.' });
      return;
    }

    setIsLoading(true);
    setAppId(null);
    setTxId(null);
    toast({ title: 'Deployment in Progress...', description: 'Compiling and submitting the transaction.' });

    try {
      const creatorAccount = mnemonicToAccount(mnemonic);
      
      const approvalBytecode = await compileProgram(APPROVAL_PROGRAM);
      const clearBytecode = await compileProgram(CLEAR_STATE_PROGRAM);
      
      const params = await algodClient.getTransactionParams().do();
      
      // We don't need any state for this simple contract
      const globalSchema = algosdk.StateSchema(0, 0);
      const localSchema = algosdk.StateSchema(0, 0);

      const txn = algosdk.makeApplicationCreateTxn(
        creatorAccount.addr,
        params,
        algosdk.OnApplicationComplete.NoOpOC,
        approvalBytecode,
        clearBytecode,
        localSchema,
        globalSchema,
      );

      const signedTxn = txn.signTxn(creatorAccount.sk);
      const { txId: sentTxId } = await algodClient.sendRawTransaction(signedTxn).do();
      
      toast({ title: 'Transaction Sent!', description: 'Waiting for confirmation...' });
      await algosdk.waitForConfirmation(algodClient, sentTxId, 4);
      
      const txResponse = await algodClient.pendingTransactionInformation(sentTxId).do();
      const newAppId = txResponse['application-index'];

      if (!newAppId) {
        throw new Error("Could not get App ID from transaction response.");
      }

      setAppId(newAppId);
      setTxId(sentTxId);
      toast({ variant: 'default', title: 'Deployment Successful!', description: `Contract deployed with App ID: ${newAppId}`});
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Deployment Failed', description: error.message || 'An unknown error occurred.' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard!" });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-6 md:p-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Deploy Smart Contract</CardTitle>
          <CardDescription>Deploy the MetaDrive smart contract directly from the browser. This action requires ALGO for network fees.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="mnemonic" className="block text-sm font-medium text-muted-foreground mb-2">
              Your 25-word Mnemonic Phrase
            </label>
            <textarea
              id="mnemonic"
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              className="w-full p-2 border rounded-md bg-muted/50 font-code h-24"
              placeholder="Enter your secret recovery phrase to sign the deployment transaction..."
            />
          </div>
          <Button onClick={handleDeploy} disabled={isLoading} className="w-full">
            {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Deploying...' : 'Deploy Contract'}
          </Button>
        </CardContent>
        {appId && txId && (
          <CardFooter className="flex-col items-start gap-4 pt-6">
             <div className="bg-green-900/50 border border-green-500 text-green-200 p-4 rounded-lg w-full">
                <h3 className="font-bold text-lg text-green-100">Deployment Successful! 🎉</h3>
                <p className="mt-2">Your smart contract is now live on the Algorand TestNet.</p>
             </div>
             <div className="w-full space-y-2 font-code">
                 <p className="text-muted-foreground">ACTION REQUIRED: Update your constants file.</p>
                 <div className="flex items-center justify-between bg-card p-3 rounded-md border">
                    <span className="text-primary-foreground">New Application ID: <span className="font-bold text-accent">{appId}</span></span>
                    <Button variant="ghost" size="icon" onClick={() => handleCopy(String(appId))}><Copy className="h-4 w-4" /></Button>
                 </div>
                 <div className="flex items-center justify-between bg-card p-3 rounded-md border">
                    <span className="text-primary-foreground">Transaction ID: <span className="font-bold text-muted-foreground">{txId.substring(0, 10)}...</span></span>
                     <Button variant="ghost" size="icon" onClick={() => handleCopy(txId)}><Copy className="h-4 w-4" /></Button>
                 </div>
             </div>
             <p className="text-sm text-center w-full text-muted-foreground pt-2">
                Copy the new Application ID and paste it as the value for `MAILBOX_APP_ID` in your `src/lib/constants.ts` file.
             </p>
          </CardFooter>
        )}
      </Card>
    </main>
  );
}
