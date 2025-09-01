
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import type { FileMetadata, Share } from '@/types';

// --- IN-MEMORY DATA STORE (Replaces MongoDB) ---
// This will reset every time the server restarts.
let filesStore: FileMetadata[] = [];
let sharesStore: Share[] = [];


const app = express();
const PORT = 3001;

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- API ROUTER ---
const apiRouter = express.Router();

// 1. Health Check
apiRouter.get('/', (req, res) => {
    res.status(200).json({ message: 'Backend is running and connected!' });
});

// 2. Save File Metadata
apiRouter.post('/files/metadata', async (req, res) => {
    try {
        const { filename, cid, size, fileType, owner } = req.body;

        if (!filename || !cid || !size || !fileType || !owner) {
            return res.status(400).json({ error: 'Missing required file metadata.' });
        }
        
        // Create a new file object for our in-memory store
        const newFile: FileMetadata = {
            _id: new Date().toISOString(), // Simple unique ID
            filename,
            cid,
            size,
            fileType,
            owner,
            createdAt: new Date().toISOString(),
        };

        filesStore.push(newFile);
        
        console.log(`[Backend] Saved metadata for CID: ${cid}`);
        res.status(201).json({ message: 'Metadata saved successfully.', file: newFile });

    } catch (error) => {
        console.error('[Backend] Error saving metadata:', error);
        res.status(500).json({ error: 'Internal server error while saving metadata.' });
    }
});

// 3. Get Files by Owner (Vault) and Shared Files (Inbox)
apiRouter.get('/files/:ownerAddress', async (req, res) => {
    try {
        const { ownerAddress } = req.params;

        // Find files owned by the user
        const ownedFiles = filesStore.filter(file => file.owner === ownerAddress);

        // Find CIDs of files shared with the user
        const sharedCids = sharesStore
            .filter(s => s.recipientAddress === ownerAddress)
            .map(s => s.cid);
        
        // Find the full file objects for those CIDs
        const sharedFiles = filesStore.filter(file => sharedCids.includes(file.cid));

        // Combine and remove duplicates
        const allFilesMap = new Map();
        [...ownedFiles, ...sharedFiles].forEach(file => {
            allFilesMap.set(file.cid, file);
        });
        
        const allFiles = Array.from(allFilesMap.values());
        
        console.log(`[Backend] Found ${allFiles.length} total files for owner ${ownerAddress.substring(0, 10)}...`);
        res.status(200).json(allFiles);
    } catch(error) {
        console.error('[Backend] Error fetching files by owner:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// 4. Share a file with another user
apiRouter.post('/share', async (req, res) => {
    try {
        const { cid, recipientAddress } = req.body;

        if (!cid || !recipientAddress) {
            return res.status(400).json({ error: 'CID and recipient address are required.' });
        }

        const file = filesStore.find(f => f.cid === cid);
        if (!file) {
            return res.status(404).json({ error: 'File not found.' });
        }

        const existingShare = sharesStore.find(s => s.cid === cid && s.recipientAddress === recipientAddress);
        if (existingShare) {
            return res.status(200).json({ message: 'File already shared with this user.' });
        }

        const newShare: Share = {
            cid,
            ownerAddress: file.owner,
            recipientAddress,
            createdAt: new Date().toISOString(),
        };
        sharesStore.push(newShare);

        console.log(`[Backend] Shared CID ${cid} with ${recipientAddress}`);
        res.status(201).json({ message: 'File shared successfully.', share: newShare });

    } catch (error) {
        console.error('[Backend] Error sharing file:', error);
        res.status(500).json({ error: 'Internal server error while sharing file.' });
    }
});

// Mount the API router at the /api prefix
app.use('/api', apiRouter);


// --- SERVER STARTUP ---
app.listen(PORT, () => {
    console.log(`✅ Backend service listening at http://localhost:${PORT}`);
});
