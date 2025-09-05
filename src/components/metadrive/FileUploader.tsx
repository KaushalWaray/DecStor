
"use client";

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { uploadFileToPinata } from '@/lib/pinata';
import { postFileMetadata } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, LoaderCircle, File as FileIcon, ShieldCheck } from 'lucide-react';
import { encryptFile } from '@/lib/crypto';


interface FileUploaderProps {
  ownerAddress: string;
  pin: string; // Add pin for encryption
  currentPath: string;
  onUploadSuccess: () => void;
}

export default function FileUploader({ ownerAddress, pin, currentPath, onUploadSuccess }: FileUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleUpload = useCallback(async () => {
    if (!selectedFile) {
      toast({ variant: 'destructive', title: 'No file selected', description: 'Please choose a file to upload.' });
      return;
    }

    setIsUploading(true);
    try {
      toast({ title: 'Encrypting your file...', description: 'Securing your file on your device before upload.' });
      const encryptedFile = await encryptFile(selectedFile, pin);

      toast({ title: 'Uploading to IPFS...', description: 'Please wait, this may take a moment.' });
      // We upload the encrypted file, but keep the original name for metadata
      const pinataResponse = await uploadFileToPinata(encryptedFile, selectedFile.name);
      
      toast({ title: 'Upload successful!', description: 'Saving encrypted file metadata.' });
      await postFileMetadata({
        filename: selectedFile.name,
        cid: pinataResponse.IpfsHash,
        size: selectedFile.size, // Store original size
        fileType: selectedFile.type,
        owner: ownerAddress,
        path: currentPath,
      });

      toast({ title: 'File saved!', description: `${selectedFile.name} is now encrypted in your vault.` });
      setSelectedFile(null);
      onUploadSuccess();
    } catch (error: any) {
      console.error(error);
      const errorMessage = error.response?.data?.error || error.message || 'An unknown error occurred.';
      toast({ variant: 'destructive', title: 'Upload Failed', description: errorMessage });
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, ownerAddress, pin, currentPath, onUploadSuccess, toast]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline text-2xl flex items-center gap-2">
            <ShieldCheck className="text-primary"/> 
            Upload Encrypted File
        </CardTitle>
        <CardDescription>Files are encrypted on your device before being uploaded to IPFS.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-full flex-grow">
            <label htmlFor="file-upload" className="sr-only">Choose file</label>
            <Input id="file-upload" type="file" onChange={handleFileChange} className="cursor-pointer" />
          </div>
          <Button onClick={handleUpload} disabled={isUploading || !selectedFile} className="w-full sm:w-auto">
            {isUploading ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Encrypt & Upload
          </Button>
        </div>
        {selectedFile && !isUploading && (
          <div className="mt-4 text-sm text-muted-foreground flex items-center gap-2">
            <FileIcon className="h-4 w-4" />
            <span>Selected: {selectedFile.name}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
