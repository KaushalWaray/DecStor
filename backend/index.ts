
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import algosdk from 'algosdk';
import fs from 'fs';
import path from 'path';

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
const DB_FILE_PATH = path.join(__dirname, 'db.json');


// --- DYNAMICALLY GENERATED SERVICE WALLET ---
const storageServiceAccount = algosdk.generateAccount();
console.log(`[Backend] Storage Service Wallet generated: ${storageServiceAccount.addr}`);
console.log(`[Backend] This address will receive payments for storage upgrades.`);


// --- FILE-BASED PERSISTENT DATABASE ---
let users: User[] = [];
let files: FileMetadata[] = [];
let shares: Share[] = [];

const saveDatabase = () => {
    try {
        const data = JSON.stringify({ users, files, shares }, null, 2);
        fs.writeFileSync(DB_FILE_PATH, data, 'utf8');
    } catch (error) {
        console.error('[Backend] CRITICAL: Failed to save database to file!', error);
    }
};

const loadDatabase = () => {
    try {
        if (fs.existsSync(DB_FILE_PATH)) {
            const data = fs.readFileSync(DB_FILE_PATH, 'utf8');
            const db = JSON.parse(data);
            users = db.users || [];
            files = db.files || [];
            shares = db.shares || [];
            console.log('[Backend] Database loaded successfully from db.json.');
        } else {
            // Create the file with empty arrays if it doesn't exist
            saveDatabase();
            console.log('[Backend] New database file created at db.json.');
        }
    } catch (error) {
        console.error('[Backend] CRITICAL: Failed to load database! Starting with empty state.', error);
        // Ensure arrays are in a clean state in case of partial load failure
        users = [];
        files = [];
        shares = [];
    }
};


// --- HELPER FUNCTIONS ---
const findOrCreateUser = (address: string): User => {
    let user = users.find(u => u.address === address);

    if (!user) {
        // User doesn't exist, so create them with the free tier plan.
        user = {
            address,
            storageLimit: FREE_TIER_LIMIT,
            storageUsed: 0,
        };
        users.push(user);
        console.log(`[Backend] Created new user ${address.substring(0,10)}... with free tier.`);
        saveDatabase(); // Persist new user
    } else {
        // If user exists, recalculate their storage used to ensure consistency.
        const userFiles = files.filter(f => f.owner === address);
        const totalSize = userFiles.reduce((acc, file) => acc + file.size, 0);
        
        if(user.storageUsed !== totalSize) {
            user.storageUsed = totalSize;
            saveDatabase(); // Persist corrected storage usage
        }
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

// NEW: Endpoint to get the dynamic service address
apiRouter.get('/service-address', (req, res) => {
    res.status(200).json({ address: storageServiceAccount.addr });
});

// 2. Save File Metadata
apiRouter.post('/files/metadata', async (req, res) => {
    try {
        const { filename, cid, size, fileType, owner } = req.body;

        if (!filename || !cid || !size || !fileType || !owner) {
            return res.status(400).json({ error: 'Missing required file metadata.' });
        }
        
        const user = findOrCreateUser(owner);
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

        files.push(newFile);

        // Update user's storage used
        user.storageUsed += size;
        
        saveDatabase(); // Persist new file and updated user storage
        
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

        const ownedFiles = files.filter(f => f.owner === ownerAddress);
        const sharedCids = shares.filter(s => s.recipientAddress === ownerAddress).map(s => s.cid);
        const sharedFiles = files.filter(f => sharedCids.includes(f.cid));
        
        const allFilesMap = new Map();
        [...ownedFiles, ...sharedFiles].forEach(file => {
            allFilesMap.set(file.cid, file);
        });
        
        const allFiles = Array.from(allFilesMap.values());
        
        const user = findOrCreateUser(ownerAddress);

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

        const file = files.find(f => f.cid === cid);
        if (!file) {
            return res.status(404).json({ error: 'File not found.' });
        }

        const existingShare = shares.find(s => s.cid === cid && s.recipientAddress === recipientAddress);
        if (existingShare) {
            return res.status(200).json({ message: 'File already shared with this user.' });
        }

        const newShare: Share = {
            cid,
            recipientAddress,
            createdAt: new Date().toISOString(),
        };
        shares.push(newShare);
        
        saveDatabase(); // Persist the new share

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

        const user = findOrCreateUser(senderAddress);
        user.storageLimit = PRO_TIER_LIMIT;
        
        saveDatabase(); // Persist the upgraded storage limit

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
app.listen(PORT, () => {
    loadDatabase(); // Load the database from file on server start
    console.log(`✅ Backend service listening at http://localhost:${PORT}`);
});
