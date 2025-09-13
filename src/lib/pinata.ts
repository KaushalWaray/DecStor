
import { PINATA_JWT } from './constants';
import { toast } from '@/hooks/use-toast';

export const uploadFileToPinata = async (file: File) => {
  if (PINATA_JWT === "PASTE_YOUR_PINATA_JWT_HERE") {
    toast({
        variant: "destructive",
        title: "Pinata JWT Missing",
        description: "Please add your Pinata JWT to src/lib/constants.ts to enable uploads.",
    });
    throw new Error("Pinata JWT Missing");
  }

  const formData = new FormData();
  formData.append('file', file);

  const metadata = JSON.stringify({
    name: file.name,
  });
  formData.append('pinataMetadata', metadata);

  const options = JSON.stringify({
    cidVersion: 0,
  });
  formData.append('pinataOptions', options);

  try {
    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      body: formData,
    });
    if (!res.ok) {
        const errorBody = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(`Pinata API Error: ${errorBody.error || res.statusText}`);
    }
    return res.json();
  } catch (error) {
    console.error("Error uploading file to Pinata: ", error);
    throw error;
  }
};
