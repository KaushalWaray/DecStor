import axios from 'axios';
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
    const res = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", formData, {
      maxBodyLength: Infinity,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${(formData as any)._boundary}`,
        Authorization: `Bearer ${PINATA_JWT}`,
      }
    });
    return res.data;
  } catch (error) {
    console.error("Error uploading to Pinata:", error);
    throw error;
  }
};
