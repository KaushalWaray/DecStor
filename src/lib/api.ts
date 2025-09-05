
import { BACKEND_URL } from './constants';
import type { FileMetadata, Folder, FilesAndStorageInfo, StorageInfo, Activity, Share, ActivityLogInfo, User } from '@/types';

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
  },
  put: async (path: string, data: any) => {
    try {
        const res = await fetch(`${BACKEND_URL}${path}`, {
          method: 'PUT',
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
  },
  delete: async (path: string, data?: any) => {
      try {
        const res = await fetch(`${BACKEND_URL}${path}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: data ? JSON.stringify(data) : undefined,
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

export const getFilesByOwner = async (ownerAddress: string, path: string, recursive: boolean = false): Promise<FilesAndStorageInfo> => {
  const params = new URLSearchParams({ path });
  if (recursive) {
    params.append('recursive', 'true');
  }
  const queryString = params.toString();
  const urlPath = `/files/${ownerAddress}?${queryString}`;

  const response = await api.get(urlPath);
  return {
      files: response.files || [],
      folders: response.folders || [],
      storageInfo: response.storageInfo,
      sharedFiles: response.sharedFiles || []
  };
};

export const recordShareInDb = async (cid: string, recipientAddress: string) => {
    return api.post('/share', { cid, recipientAddress });
};

export const findOrCreateUserInDb = async (address: string, walletName?: string): Promise<{user: User}> => {
    return api.post('/users/find-or-create', { address, walletName });
};

export const renameWallet = async (address: string, newName: string): Promise<{ user: User }> => {
    return api.put(`/users/${address}/rename`, { newName });
}

export const confirmPayment = async (senderAddress: string, txId: string, recipientAddress: string, amount: number): Promise<{ storageInfo: StorageInfo }> => {
    return api.post('/payment/confirm', { senderAddress, txId, recipientAddress, amount });
}

export const getStorageServiceAddress = async (): Promise<{address: string}> => {
    return api.get('/service-address');
}

export const createFolder = async (folder: Omit<Folder, '_id' | 'createdAt'>): Promise<{folder: Folder}> => {
    return api.post('/folders', folder);
}

export const renameFolder = async (folderId: string, ownerAddress: string, newName: string) => {
    return api.put(`/folders/${folderId}/rename`, { ownerAddress, newName });
};

export const renameFile = async (fileId: string, ownerAddress: string, newName: string) => {
    return api.put(`/files/${fileId}/rename`, { ownerAddress, newName });
};

export const moveItems = async (ownerAddress: string, itemIds: string[], itemTypes: ('file' | 'folder')[], newPath: string) => {
    return api.put('/items/move', { ownerAddress, itemIds, itemTypes, newPath });
}

export const deleteItems = async (ownerAddress: string, itemIds: string[]) => {
    return api.post('/items/delete', { ownerAddress, itemIds });
}

// Get notifications/activity logs
export const getNotifications = async (ownerAddress: string): Promise<ActivityLogInfo> => {
    return api.get(`/activity/${ownerAddress}`);
}

// Mark notifications as read
export const markNotificationsAsRead = async (ownerAddress: string): Promise<{ message: string }> => {
    return api.post('/activity/mark-read', { ownerAddress });
}


export default api;
