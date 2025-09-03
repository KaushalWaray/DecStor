
import { BACKEND_URL } from './constants';
import type { FileMetadata, FilesAndStorageInfo, StorageInfo } from '@/types';

const api = {
  get: async (path: string) => {
    const res = await fetch(`${BACKEND_URL}${path}`);
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    return res.json();
  },
  post: async (path: string, data: any) => {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
        const errorBody = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(`API Error: ${errorBody.error || res.statusText}`);
    }
    return res.json();
  }
};


export const checkApiHealth = async () => {
  return api.get('/');
};

export const postFileMetadata = async (metadata: Omit<FileMetadata, '_id' | 'createdAt'>) => {
  return api.post('/files/metadata', metadata);
};

export const getFilesByOwner = async (ownerAddress: string): Promise<FilesAndStorageInfo> => {
  return api.get(`/files/${ownerAddress}`);
};

export const recordShareInDb = async (cid: string, recipientAddress: string) => {
    return api.post('/share', { cid, recipientAddress });
};

export const confirmPayment = async (senderAddress: string, txId: string): Promise<StorageInfo> => {
    const res = await api.post('/payment/confirm', { senderAddress, txId });
    return res.storageInfo;
}


export default api;
