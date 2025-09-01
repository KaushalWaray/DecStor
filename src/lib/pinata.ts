import { PINATA_JWT } from './constants';

export const uploadFileToPinata = async (file: File) => {
  if (PINATA_JWT === "PASTE_YOUR_JWT_HERE") {
    throw new Error("Pinata JWT is not configured. Please paste your JWT in src/lib/constants.ts");
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
    console.error("Error uploading to Pinata:", error);
    throw error;
  }
};
