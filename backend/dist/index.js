import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import algosdk from 'algosdk';
import fs from 'fs';
import path from 'path';
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
let users = [];
let files = [];
let shares = [];
let folders = [];
const saveDatabase = () => {
    try {
        const data = JSON.stringify({ users, files, shares, folders }, null, 2);
        fs.writeFileSync(DB_FILE_PATH, data, 'utf8');
    }
    catch (error) {
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
            folders = db.folders || [];
            console.log('[Backend] Database loaded successfully from db.json.');
        }
        else {
            // Create the file with empty arrays if it doesn't exist
            saveDatabase();
            console.log('[Backend] New database file created at db.json.');
        }
    }
    catch (error) {
        console.error('[Backend] CRITICAL: Failed to load database! Starting with empty state.', error);
        // Ensure arrays are in a clean state in case of partial load failure
        users = [];
        files = [];
        shares = [];
        folders = [];
    }
};
// --- HELPER FUNCTIONS ---
const findOrCreateUser = (address) => {
    let user = users.find(u => u.address === address);
    if (!user) {
        // User doesn't exist, so create them with the free tier plan.
        user = {
            address,
            storageLimit: FREE_TIER_LIMIT,
            storageUsed: 0,
        };
        users.push(user);
        console.log(`[Backend] Created new user ${address.substring(0, 10)}... with free tier.`);
        saveDatabase(); // Persist new user
    }
    else {
        // If user exists, recalculate their storage used to ensure consistency.
        const userFiles = files.filter(f => f.owner === address);
        const totalSize = userFiles.reduce((acc, file) => acc + file.size, 0);
        if (user.storageUsed !== totalSize) {
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
        const { filename, cid, size, fileType, owner, path } = req.body;
        if (!filename || !cid || !size || !fileType || !owner || path === undefined) {
            return res.status(400).json({ error: 'Missing required file metadata.' });
        }
        const user = findOrCreateUser(owner);
        if (user.storageUsed + size > user.storageLimit) {
            console.log(`[Backend] Quota exceeded for ${owner.substring(0, 10)}...`);
            return res.status(413).json({
                error: 'Storage quota exceeded.',
                details: `You have used ${user.storageUsed} of ${user.storageLimit} bytes.`
            });
        }
        const newFile = {
            _id: new Date().toISOString() + Math.random(), // Simple unique ID
            filename,
            cid,
            size,
            fileType,
            owner,
            path,
            createdAt: new Date().toISOString(),
        };
        files.push(newFile);
        // Update user's storage used
        user.storageUsed += size;
        saveDatabase(); // Persist new file and updated user storage
        console.log(`[Backend] Saved metadata for CID: ${cid} at path ${path}`);
        res.status(201).json({ message: 'Metadata saved successfully.', file: newFile });
    }
    catch (error) {
        console.error('[Backend] Error saving metadata:', error);
        res.status(500).json({ error: 'Internal server error while saving metadata.' });
    }
});
// 3. Get Files and Folders by Owner and Path
apiRouter.get('/files/:ownerAddress', async (req, res) => {
    try {
        const { ownerAddress } = req.params;
        const currentPath = req.query.path || '/';
        // Get owned files and folders for the current path
        const ownedFiles = files.filter(f => f.owner === ownerAddress && f.path === currentPath);
        const ownedFolders = folders.filter(f => f.owner === ownerAddress && f.path === currentPath);
        // Get shared files (for inbox functionality - path independent for simplicity for now)
        const sharedCids = shares.filter(s => s.recipientAddress === ownerAddress).map(s => s.cid);
        const sharedFiles = files.filter(f => sharedCids.includes(f.cid));
        // For the main vault view, we only want owned items.
        // For a more complex "Shared with me" section, we'd handle shared folders separately.
        const user = findOrCreateUser(ownerAddress);
        console.log(`[Backend] Found ${ownedFiles.length} files and ${ownedFolders.length} folders for owner ${ownerAddress.substring(0, 10)}... at path ${currentPath}`);
        res.status(200).json({
            files: ownedFiles,
            folders: ownedFolders,
            sharedFiles: sharedFiles, // Keep sending all shared files for the inbox
            storageInfo: {
                storageUsed: user.storageUsed,
                storageLimit: user.storageLimit
            }
        });
    }
    catch (error) {
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
        const newShare = {
            cid,
            recipientAddress,
            createdAt: new Date().toISOString(),
        };
        shares.push(newShare);
        saveDatabase(); // Persist the new share
        console.log(`[Backend] Shared CID ${cid} with ${recipientAddress}`);
        res.status(201).json({ message: 'File shared successfully.', share: newShare });
    }
    catch (error) {
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
        console.log(`[Backend] Received payment confirmation for tx: ${txId.substring(0, 10)}... from ${senderAddress.substring(0, 10)}...`);
        const user = findOrCreateUser(senderAddress);
        user.storageLimit = PRO_TIER_LIMIT;
        saveDatabase(); // Persist the upgraded storage limit
        console.log(`[Backend] Upgraded ${user.address.substring(0, 10)}... to Pro tier.`);
        res.status(200).json({
            message: "Payment confirmed and storage upgraded successfully!",
            storageInfo: {
                storageUsed: user.storageUsed,
                storageLimit: user.storageLimit,
            }
        });
    }
    catch (error) {
        console.error('[Backend] Error confirming payment:', error);
        res.status(500).json({ error: 'Internal server error while confirming payment.' });
    }
});
// 6. Delete a file
apiRouter.delete('/files/:cid', (req, res) => {
    try {
        const { cid } = req.params;
        const { ownerAddress } = req.body;
        if (!cid || !ownerAddress) {
            return res.status(400).json({ error: 'File CID and owner address are required.' });
        }
        const fileIndex = files.findIndex(f => f.cid === cid && f.owner === ownerAddress);
        if (fileIndex === -1) {
            return res.status(404).json({ error: 'File not found or you do not have permission to delete it.' });
        }
        const fileToDelete = files[fileIndex];
        const user = findOrCreateUser(ownerAddress);
        // Update user's storage usage
        user.storageUsed -= fileToDelete.size;
        // Remove the file from the database
        files.splice(fileIndex, 1);
        // Also remove any shares associated with this file
        shares = shares.filter(s => s.cid !== cid);
        saveDatabase(); // Persist changes
        console.log(`[Backend] Deleted file with CID: ${cid}`);
        res.status(200).json({ message: 'File deleted successfully.' });
    }
    catch (error) {
        console.error('[Backend] Error deleting file:', error);
        res.status(500).json({ error: 'Internal server error while deleting file.' });
    }
});
// 7. Create a new folder
apiRouter.post('/folders', (req, res) => {
    try {
        const { name, owner, path } = req.body;
        if (!name || !owner || path === undefined) {
            return res.status(400).json({ error: 'Folder name, owner, and path are required.' });
        }
        // Check if a folder with the same name already exists in the same path for this user
        const existingFolder = folders.find(f => f.owner === owner && f.path === path && f.name === name);
        if (existingFolder) {
            return res.status(409).json({ error: `A folder named '${name}' already exists in this location.` });
        }
        const newFolder = {
            _id: new Date().toISOString() + Math.random(),
            name,
            owner,
            path,
            createdAt: new Date().toISOString()
        };
        folders.push(newFolder);
        saveDatabase();
        console.log(`[Backend] Created folder '${name}' at path '${path}' for owner ${owner.substring(0, 10)}...`);
        res.status(201).json({ message: 'Folder created successfully.', folder: newFolder });
    }
    catch (error) {
        console.error('[Backend] Error creating folder:', error);
        res.status(500).json({ error: 'Internal server error while creating folder.' });
    }
});
// Mount the API router at the /api prefix
app.use('/api', apiRouter);
// --- SERVER STARTUP ---
app.listen(PORT, () => {
    loadDatabase(); // Load the database from file on server start
    console.log(`✅ Backend service listening at http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map