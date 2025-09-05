
"use client";

import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { uploadFileToPinata } from '@/lib/pinata';
import { postFileMetadata } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, LoaderCircle, File as FileIcon, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { encryptFile } from '@/lib/crypto';
import { cn } from '@/lib/utils';


interface FileUploaderProps {
  ownerAddress: string;
  pin: string; // Add pin for encryption
  currentPath: string;
  onUploadSuccess: () => void;
}

export default function FileUploader({ ownerAddress, pin, currentPath, onUploadSuccess }: FileUploaderProps) {
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ total: 0, completed: 0 });
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFilesToUpload(Array.from(event.target.files));
    }
  };

  const handleUpload = useCallback(async () => {
    if (filesToUpload.length === 0) {
      toast({ variant: 'destructive', title: 'No files selected', description: 'Please choose one or more files to upload.' });
      return;
    }

    setIsUploading(true);
    setUploadProgress({ total: filesToUpload.length, completed: 0 });

    for (const file of filesToUpload) {
        try {
          toast({ title: `Encrypting ${file.name}...`, description: 'Securing your file on your device before upload.' });
          const encryptedFile = await encryptFile(file, pin);

          toast({ title: `Uploading ${file.name}...`, description: 'Please wait, this may take a moment.' });
          const pinataResponse = await uploadFileToPinata(encryptedFile, file.name);
          
          await postFileMetadata({
            filename: file.name,
            cid: pinataResponse.IpfsHash,
            size: file.size, // Store original size
            fileType: file.type,
            owner: ownerAddress,
            path: currentPath,
          });

          setUploadProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
        } catch (error: any) {
          console.error(error);
          const errorMessage = error.response?.data?.error || error.message || 'An unknown error occurred.';
          toast({ variant: 'destructive', title: `Upload Failed for ${file.name}`, description: errorMessage });
          // Optional: decide whether to continue or stop on error
        }
    }
    
    toast({ 
        title: 'Uploads Complete!', 
        description: `${filesToUpload.length} of ${filesToUpload.length} files saved to your vault.`,
        className: 'bg-green-500 text-white',
        duration: 5000,
    });
    
    setFilesToUpload([]);
    onUploadSuccess();
    setIsUploading(false);
  }, [filesToUpload, ownerAddress, pin, currentPath, onUploadSuccess, toast]);

  const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(true);
  };
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
  };
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault(); // This is necessary to allow dropping
      setIsDragOver(true);
  };
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files) {
          setFilesToUpload(Array.from(e.dataTransfer.files));
      }
  };

  return (
    <div
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={cn(
            "rounded-lg border-2 border-dashed p-4 transition-colors duration-200",
            isDragOver ? "border-primary bg-primary/10" : "border-border",
            isUploading ? "border-solid" : "border-dashed"
        )}
    >
        <Card className="shadow-none border-none bg-transparent">
        <CardHeader>
            <CardTitle className="font-headline text-2xl flex items-center gap-2">
                <ShieldCheck className="text-primary"/> 
                Upload Encrypted Files
            </CardTitle>
            <CardDescription>Drag & drop files here, or click to browse. Files are encrypted before upload.</CardDescription>
        </CardHeader>
        <CardContent>
            {isUploading ? (
                 <div className="space-y-2 text-center">
                    <LoaderCircle className="mx-auto h-12 w-12 animate-spin text-primary" />
                    <p className="font-semibold">Uploading {uploadProgress.completed + 1} of {uploadProgress.total}...</p>
                    <p className="text-muted-foreground text-sm">{filesToUpload[uploadProgress.completed]?.name}</p>
                </div>
            ) : (
                <>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-full flex-grow">
                        <Input 
                            id="file-upload" 
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange} 
                            className="hidden" 
                            multiple
                        />
                        <Button 
                            variant="outline"
                            className="w-full h-12"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {filesToUpload.length > 0
                                ? `${filesToUpload.length} file(s) selected`
                                : "Click to browse files"
                            }
                        </Button>
                    </div>
                    <Button onClick={handleUpload} disabled={isUploading || filesToUpload.length === 0} className="w-full sm:w-auto h-12">
                        <Upload className="mr-2 h-4 w-4" />
                        Encrypt & Upload All
                    </Button>
                </div>
                {filesToUpload.length > 0 && (
                    <div className="mt-4 text-sm text-muted-foreground space-y-1">
                        <h4 className="font-semibold text-foreground">Selected files:</h4>
                        <ul className="list-disc pl-5">
                            {filesToUpload.map((file, i) => (
                                <li key={i}>{file.name}</li>
                            ))}
                        </ul>
                    </div>
                )}
                </>
            )}
        </CardContent>
        </Card>
    </div>
  );
}
