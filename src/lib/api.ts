import axios from 'axios';
import { BACKEND_URL } from './constants';
import type { FileMetadata } from '@/types';

const api = axios.create({
  baseURL: BACKEND_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const checkApiHealth = async () => {
  return api.get('/');
};

export const postFileMetadata = async (metadata: Omit<FileMetadata, '_id' | 'createdAt'>) => {
  return api.post('/files/metadata', metadata);
};

export const getFilesByOwner = async (ownerAddress: string): Promise<FileMetadata[]> => {
  const response = await api.get(`/files/${ownerAddress}`);
  return response.data;
};

export const getFilesByCids = async (cids: string[]): Promise<FileMetadata[]> => {
  const response = await api.post('/files/by-cids', { cids });
  return response.data;
};

export default api;
