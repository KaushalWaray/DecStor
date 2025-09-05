"use client";

import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface WelcomeScreenProps {
  onCreate: () => void;
  onImport: () => void;
}

export default function WelcomeScreen({ onCreate, onImport }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Card className="w-full max-w-md animate-fade-in-up">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit">
            <Shield className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="text-3xl font-headline mt-4">Welcome to DecStor</CardTitle>
          <CardDescription className="text-lg">Your secure, decentralized vault.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button size="lg" onClick={onCreate}>Create a New Wallet</Button>
          <Button size="lg" variant="secondary" onClick={onImport}>Import Existing Wallet</Button>
        </CardContent>
      </Card>
    </div>
  );
}
