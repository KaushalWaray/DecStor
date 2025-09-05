
import { BACKEND_URL } from './constants';
import type { FileMetadata, Folder, FilesAndStorageInfo, StorageInfo } from '@/types';

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
  const url = new URL(`${BACKEND_URL}/files/${ownerAddress}`);
  url.searchParams.append('path', path);
  if (recursive) {
      url.searchParams.append('recursive', 'true');
  }
  const response = await api.get(url.pathname + url.search);
  return {
      files: response.files || [],
      folders: response.folders || [],
      storageInfo: response.storageInfo,
      sharedFiles: response.sharedFiles || []
  };
};


export const getAllFolders = async (ownerAddress: string): Promise<{folders: Folder[]}> => {
    const response = await getFilesByOwner(ownerAddress, '/', true);
    return {
        folders: response.folders || [],
    }
}

export const recordShareInDb = async (cid: string, recipientAddress: string) => {
    return api.post('/share', { cid, recipientAddress });
};

export const confirmPayment = async (senderAddress: string, txId: string): Promise<StorageInfo> => {
    const res = await api.post('/payment/confirm', { senderAddress, txId });
    return res.storageInfo;
}

export const getStorageServiceAddress = async (): Promise<{address: string}> => {
    return api.get('/service-address');
}

export const deleteFileFromDb = async (cid: string, ownerAddress: string) => {
    return api.delete(`/files/${cid}`, { ownerAddress });
}

export const createFolder = async (folder: Omit<Folder, '_id' | 'createdAt'>): Promise<{folder: Folder}> => {
    return api.post('/folders', folder);
}

export const moveFile = async (cid: string, ownerAddress: string, newPath: string) => {
    return api.put(`/files/${cid}/move`, { ownerAddress, newPath });
};

export const deleteFolder = async (folderId: string, ownerAddress: string) => {
    return api.delete(`/folders/${folderId}`, { ownerAddress });
};

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


export default api;
