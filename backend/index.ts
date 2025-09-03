
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// --- SELF-CONTAINED TYPE DEFINITIONS ---
export interface FileMetadata {
  _id: string;
  filename: string;
  cid: string;
  size: number;
  fileType: string;
  owner: string;
  createdAt: string;
}

export interface Share {
  cid: string;
  ownerAddress: string;
  recipientAddress: string;
  createdAt: string;
}

export interface User {
    address: string;
    storageLimit: number;
    storageUsed: number;
}
// --- END OF TYPE DEFINITIONS ---


// --- CONSTANTS ---
const FREE_TIER_LIMIT = 1 * 1024 * 1024; // 1 MB
const PRO_TIER_LIMIT = 100 * 1024 * 1024; // 100 MB
const PORT = 3001;

// --- DATABASE INITIALIZATION ---
// We are using a Promise-based wrapper around the sqlite3 library.
// The database will be created in a file named `database.db` in the backend directory.
let db: any;

async function initializeDatabase() {
    try {
        db = await open({
            filename: './database.db',
            driver: sqlite3.Database
        });

        console.log('[Backend] Connected to the SQLite database.');

        // Create tables if they don't exist
        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                address TEXT PRIMARY KEY,
                storageLimit INTEGER NOT NULL,
                storageUsed INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS files (
                _id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                cid TEXT NOT NULL UNIQUE,
                size INTEGER NOT NULL,
                fileType TEXT NOT NULL,
                owner TEXT NOT NULL,
                createdAt TEXT NOT NULL,
                FOREIGN KEY(owner) REFERENCES users(address)
            );
            CREATE TABLE IF NOT EXISTS shares (
                cid TEXT NOT NULL,
                recipientAddress TEXT NOT NULL,
                createdAt TEXT NOT NULL,
                PRIMARY KEY (cid, recipientAddress)
            );
        `);
        console.log('[Backend] Database tables are ready.');
    } catch (error) {
        console.error('[Backend] Error initializing database:', error);
        process.exit(1); // Exit if we can't connect to the DB
    }
}


// --- HELPER FUNCTIONS ---
const findOrCreateUser = async (address: string): Promise<User> => {
    // First, try to find the user in the database.
    let user = await db.get('SELECT * FROM users WHERE address = ?', address);

    if (!user) {
        // User doesn't exist, so create them with the free tier plan.
        user = {
            address,
            storageLimit: FREE_TIER_LIMIT,
            storageUsed: 0, // A new user starts with 0 storage used.
        };
        await db.run(
            'INSERT INTO users (address, storageLimit, storageUsed) VALUES (?, ?, ?)',
            user.address, user.storageLimit, user.storageUsed
        );
        console.log(`[Backend] Created new user ${address.substring(0,10)}... with free tier.`);
    } else {
        // If user exists, recalculate their storage used to ensure consistency.
        const result = await db.get('SELECT SUM(size) as totalSize FROM files WHERE owner = ?', address);
        user.storageUsed = result.totalSize || 0;
        await db.run('UPDATE users SET storageUsed = ? WHERE address = ?', user.storageUsed, address);
    }
    return user;
};


const app = express();

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
        
        const user = await findOrCreateUser(owner);
        if (user.storageUsed + size > user.storageLimit) {
            console.log(`[Backend] Quota exceeded for ${owner.substring(0,10)}...`);
            return res.status(413).json({
                error: 'Storage quota exceeded.',
                details: `You have used ${user.storageUsed} of ${user.storageLimit} bytes.`
            });
        }
        
        const newFile: FileMetadata = {
            _id: new Date().toISOString() + Math.random(), // Simple unique ID
            filename,
            cid,
            size,
            fileType,
            owner,
            createdAt: new Date().toISOString(),
        };

        // Insert into the database
        await db.run(
            'INSERT INTO files (_id, filename, cid, size, fileType, owner, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            newFile._id, newFile.filename, newFile.cid, newFile.size, newFile.fileType, newFile.owner, newFile.createdAt
        );

        // Update user's storage used
        await db.run('UPDATE users SET storageUsed = storageUsed + ? WHERE address = ?', size, owner);
        
        console.log(`[Backend] Saved metadata for CID: ${cid}`);
        res.status(201).json({ message: 'Metadata saved successfully.', file: newFile });

    } catch (error) {
        console.error('[Backend] Error saving metadata:', error);
        res.status(500).json({ error: 'Internal server error while saving metadata.' });
    }
});

// 3. Get Files and User Storage Info
apiRouter.get('/files/:ownerAddress', async (req, res) => {
    try {
        const { ownerAddress } = req.params;

        const ownedFiles = await db.all('SELECT * FROM files WHERE owner = ?', ownerAddress);

        const sharedCidsResult = await db.all('SELECT cid FROM shares WHERE recipientAddress = ?', ownerAddress);
        const sharedCids = sharedCidsResult.map((s: { cid: string }) => s.cid);
        
        let sharedFiles: FileMetadata[] = [];
        if (sharedCids.length > 0) {
            // Create placeholders for a parameterized query
            const placeholders = sharedCids.map(() => '?').join(',');
            sharedFiles = await db.all(`SELECT * FROM files WHERE cid IN (${placeholders})`, ...sharedCids);
        }

        const allFilesMap = new Map();
        [...ownedFiles, ...sharedFiles].forEach(file => {
            allFilesMap.set(file.cid, file);
        });
        
        const allFiles = Array.from(allFilesMap.values());
        
        const user = await findOrCreateUser(ownerAddress);

        console.log(`[Backend] Found ${allFiles.length} total files for owner ${ownerAddress.substring(0, 10)}...`);
        res.status(200).json({
            files: allFiles,
            storageInfo: {
                storageUsed: user.storageUsed,
                storageLimit: user.storageLimit
            }
        });
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

        const file = await db.get('SELECT * FROM files WHERE cid = ?', cid);
        if (!file) {
            return res.status(404).json({ error: 'File not found.' });
        }

        const existingShare = await db.get('SELECT * FROM shares WHERE cid = ? AND recipientAddress = ?', cid, recipientAddress);
        if (existingShare) {
            return res.status(200).json({ message: 'File already shared with this user.' });
        }

        const newShare = {
            cid,
            recipientAddress,
            createdAt: new Date().toISOString(),
        };
        await db.run('INSERT INTO shares (cid, recipientAddress, createdAt) VALUES (?, ?, ?)', newShare.cid, newShare.recipientAddress, newShare.createdAt);

        console.log(`[Backend] Shared CID ${cid} with ${recipientAddress}`);
        res.status(201).json({ message: 'File shared successfully.', share: newShare });

    } catch (error) {
        console.error('[Backend] Error sharing file:', error);
        res.status(500).json({ error: 'Internal server error while sharing file.' });
    }
});

// 5. Confirm a payment and upgrade user's storage
apiRouter.post('/payment/confirm', async (req, res) => {
    try {
        const { senderAddress, txId } = req.body;
        if (!senderAddress || !txId) {
            return res.status(400).json({ error: 'Sender address and transaction ID are required.' });
        }

        console.log(`[Backend] Received payment confirmation for tx: ${txId.substring(0,10)}... from ${senderAddress.substring(0,10)}...`);

        const user = await findOrCreateUser(senderAddress);
        await db.run('UPDATE users SET storageLimit = ? WHERE address = ?', PRO_TIER_LIMIT, senderAddress);
        
        user.storageLimit = PRO_TIER_LIMIT; // Update local object to return correct data

        console.log(`[Backend] Upgraded ${user.address.substring(0,10)}... to Pro tier.`);
        res.status(200).json({
            message: "Payment confirmed and storage upgraded successfully!",
            storageInfo: {
                storageUsed: user.storageUsed,
                storageLimit: user.storageLimit,
            }
        });

    } catch (error) {
        console.error('[Backend] Error confirming payment:', error);
        res.status(500).json({ error: 'Internal server error while confirming payment.' });
    }
});


// Mount the API router at the /api prefix
app.use('/api', apiRouter);


// --- SERVER STARTUP ---
// We must initialize the database before starting the server.
initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`✅ Backend service listening at http://localhost:${PORT}`);
    });
});
