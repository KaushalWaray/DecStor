
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import File from './models/File';

const app = express();
const PORT = 3001;

// --- DATABASE CONNECTION ---
// Make sure you have a MongoDB server running.
// You can use a local instance or a cloud service like MongoDB Atlas.
// Update the connection string in your .env file.
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/metadrive';

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB connected successfully.'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        process.exit(1); // Exit if we can't connect to the database
    });

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- API ROUTES ---
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

// 3. Get Files by Owner (Vault)
apiRouter.get('/files/:owner', async (req, res) => {
    try {
        const { owner } = req.params;
        const ownerFiles = await File.find({ owner: owner });
        console.log(`[Backend] Found ${ownerFiles.length} files for owner ${owner.substring(0, 10)}...`);
        res.status(200).json(ownerFiles);
    } catch(error) {
        console.error('[Backend] Error fetching files by owner:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// 4. Get Files by CIDs (Inbox)
apiRouter.post('/files/by-cids', async (req, res) => {
    try {
        const { cids } = req.body;
        if (!cids || !Array.isArray(cids)) {
            return res.status(400).json({ error: 'An array of CIDs is required.' });
        }
        const foundFiles = await File.find({ cid: { $in: cids } });
        console.log(`[Backend] Found metadata for ${foundFiles.length} CIDs.`);
        res.status(200).json(foundFiles);
    } catch (error) {
        console.error('[Backend] Error fetching files by CIDs:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.use('/api', apiRouter);

// --- SERVER STARTUP ---
app.listen(PORT, () => {
    console.log(`✅ Backend service listening at http://localhost:${PORT}`);
});
