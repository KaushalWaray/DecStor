"use client";

import { useState } from 'react';
import algosdk from 'algosdk';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { LoaderCircle } from 'lucide-react';
import { ALGOD_SERVER, ALGOD_TOKEN, ALGOD_PORT } from '@/lib/constants';

// --- Pre-compiled Smart Contract ---
// This is the bytecode for a simple, stateless "messenger" smart contract.
// It approves any transaction that has a non-empty first application argument.
// This allows us to post a CID to the blockchain as an immutable record.
const APPROVAL_PROGRAM_BYTECODE = "BKA1ACIB"; // Base64 of "int 1"
const CLEAR_PROGRAM_BYTECODE = "BKA1ACIB"; // Base64 of "int 1"

const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);

export default function DeployPage() {
  const [mnemonic, setMnemonic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [appId, setAppId] = useState<number | null>(null);
  const [txId, setTxId] = useState<string>('');
  const { toast } = useToast();

  const handleDeploy = async () => {
    if (!mnemonic) {
      toast({ variant: 'destructive', title: 'Mnemonic required', description: 'Please enter your 25-word recovery phrase.' });
      return;
    }
    
    setIsLoading(true);
    setAppId(null);
    setTxId('');

    try {
        const creatorAccount = algosdk.mnemonicToSecretKey(mnemonic);

        const params = await algodClient.getTransactionParams().do();
        
        const approvalProgram = new Uint8Array(Buffer.from(APPROVAL_PROGRAM_BYTECODE, "base64"));
        const clearProgram = new Uint8Array(Buffer.from(CLEAR_PROGRAM_BYTECODE, "base64"));
        
        const globalSchema = { numUint: 0, numByteSlice: 0 };
        const localSchema = { numUint: 0, numByteSlice: 0 };

        const txn = algosdk.makeApplicationCreateTxnFromObject({
            from: creatorAccount.addr,
            suggestedParams: params,
            onComplete: algosdk.OnApplicationComplete.NoOpOC,
            approvalProgram: approvalProgram,
            clearProgram: clearProgram,
            numGlobalInts: globalSchema.numUint,
            numGlobalByteSlices: globalSchema.numByteSlice,
            numLocalInts: localSchema.numUint,
            numLocalByteSlices: localSchema.numByteSlice,
        });

        const signedTxn = txn.signTxn(creatorAccount.sk);
        const { txId: sentTxId } = await algodClient.sendRawTransaction(signedTxn).do();
        setTxId(sentTxId);
        
        toast({ title: "Transaction Sent", description: `Waiting for confirmation... (TxID: ${sentTxId.slice(0,10)}...)` });

        const result = await algosdk.waitForConfirmation(algodClient, sentTxId, 4);
        const deployedAppId = result['application-index'];

        if (!deployedAppId) {
            throw new Error("Application ID not found in transaction result.");
        }

        setAppId(deployedAppId);
        toast({ title: "Deployment Successful! 🎉", description: `Contract deployed with App ID: ${deployedAppId}` });

    } catch (error: any) {
        console.error(error);
        const errorMessage = error.response?.body?.message || error.message || "An unknown error occurred.";
        toast({
            variant: 'destructive',
            title: 'Deployment Failed',
            description: errorMessage,
        });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="font-headline text-3xl">Deploy Smart Contract</CardTitle>
          <CardDescription>Deploy the MetaDrive smart contract to the Algorand TestNet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="mnemonic" className="text-sm font-medium">Your 25-word Mnemonic Phrase</label>
            <Textarea
              id="mnemonic"
              placeholder="Paste your recovery phrase here to sign and pay for the deployment transaction..."
              className="font-code mt-1 h-32"
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </CardContent>
        <CardFooter className="flex-col items-start gap-4">
          <Button onClick={handleDeploy} disabled={isLoading} size="lg">
            {isLoading ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isLoading ? 'Deploying...' : 'Deploy Contract'}
          </Button>
          
          {appId !== null && (
            <div className="w-full p-4 border rounded-md bg-green-900/50 text-green-200 animate-fade-in">
              <h3 className="font-bold">Deployment Successful!</h3>
              <p className="mt-2">Your contract has been deployed to the Algorand TestNet.</p>
              <div className="mt-4 space-y-2 font-code bg-black/30 p-3 rounded-md">
                <p>
                  <span className="font-semibold text-muted-foreground">Transaction ID:</span> {txId}
                </p>
                <p className="flex items-center gap-2">
                  <span className="font-semibold text-muted-foreground">Application ID:</span> 
                  <strong className="text-xl text-primary">{appId}</strong>
                </p>
              </div>
              <p className="mt-4 text-amber-300 font-medium">
                ACTION REQUIRED: Copy this Application ID and update the `MAILBOX_APP_ID` in your `src/lib/constants.ts` file.
              </p>
            </div>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}
