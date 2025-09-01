
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import File from './models/File';
import Share from './models/Share';

const app = express();
const PORT = 3001;

// --- DATABASE CONNECTION ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/metadrive';

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB connected successfully.'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        process.exit(1);
    });

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

        const newFile = new File({ filename, cid, size, fileType, owner });
        await newFile.save();
        
        console.log(`[Backend] Saved metadata for CID: ${cid}`);
        res.status(201).json({ message: 'Metadata saved successfully.', file: newFile });

    } catch (error) {
        console.error('[Backend] Error saving metadata:', error);
        res.status(500).json({ error: 'Internal server error while saving metadata.' });
    }
});

// 3. Get Files by Owner (Vault) and Shared Files (Inbox)
apiRouter.get('/files/:ownerAddress', async (req, res) => {
    try {
        const { ownerAddress } = req.params;

        // Find files owned by the user
        const ownedFiles = await File.find({ owner: ownerAddress });

        // Find files shared with the user
        const shares = await Share.find({ recipientAddress: ownerAddress }).select('cid');
        const sharedCids = shares.map(s => s.cid);
        const sharedFiles = await File.find({ cid: { $in: sharedCids } });

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

        const file = await File.findOne({ cid });
        if (!file) {
            return res.status(404).json({ error: 'File not found.' });
        }

        const existingShare = await Share.findOne({ cid, recipientAddress });
        if (existingShare) {
            return res.status(200).json({ message: 'File already shared with this user.' });
        }

        const newShare = new Share({
            cid,
            ownerAddress: file.owner,
            recipientAddress,
        });
        await newShare.save();

        console.log(`[Backend] Shared CID ${cid} with ${recipientAddress}`);
        res.status(201).json({ message: 'File shared successfully.', share: newShare });

    } catch (error) {
        console.error('[Backend] Error sharing file:', error);
        res.status(500).json({ error: 'Internal server error while sharing file.' });
    }
});

// Mount the API router
app.use('/api', apiRouter);


// --- SERVER STARTUP ---
app.listen(PORT, () => {
    console.log(`✅ Backend service listening at http://localhost:${PORT}`);
});
