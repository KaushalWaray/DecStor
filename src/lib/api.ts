
import { BACKEND_URL } from './constants';
import type { FileMetadata, FilesAndStorageInfo, StorageInfo } from '@/types';

const api = {
  get: async (path: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}${path}`);
      if (!res.ok) {
        // Try to parse a JSON error response from the backend
        const errorBody = await res.json().catch(() => ({ error: res.statusText || 'Unknown API Error' }));
        throw new Error(`API Error: ${errorBody.error}`);
      }
      return res.json();
    } catch (error: any) {
        // This catches network errors where the backend is not reachable
        if (error.name === 'TypeError') {
            throw new Error('Network Error: Could not connect to the backend server. Is it running?');
        }
        throw error;
    }
  },
  post: async (path: string, data: any) => {
    try {
        const res = await fetch(`${BACKEND_URL}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
            const errorBody = await res.json().catch(() => ({ error: res.statusText || 'Unknown API Error' }));
            throw new Error(`API Error: ${errorBody.error || res.statusText}`);
        }
        return res.json();
    } catch (error: any) {
        if (error.name === 'TypeError') {
            throw new Error('Network Error: Could not connect to the backend server. Is it running?');
        }
        throw error;
    }
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
