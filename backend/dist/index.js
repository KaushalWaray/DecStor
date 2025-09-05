import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import algosdk from 'algosdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// --- END OF TYPE DEFINITIONS ---
// --- CONSTANTS ---
const FREE_TIER_LIMIT = 1 * 1024 * 1024; // 1 MB
const PRO_TIER_LIMIT = 100 * 1024 * 1024; // 100 MB
const PORT = 3001;
// Correctly determine __dirname in ES module scope
const __filename = fileURLToPath(import.meta.url);
// The DB file should be in the root of the 'backend' folder, not in 'dist'
const DB_FILE_PATH = path.join(path.dirname(__filename), '..', 'db.json');
// --- PERSISTENT SERVICE WALLET ---
let storageServiceAccount;
try {
    const mnemonic = process.env.SERVICE_WALLET_MNEMONIC;
    if (!mnemonic) {
        const newAccount = algosdk.generateAccount();
        console.error("\n[Backend] FATAL: SERVICE_WALLET_MNEMONIC not set in environment.");
        console.error("=".repeat(60));
        console.error("A new wallet has been generated for you. Please take action:");
        console.error("1. Create a file named .env in the /backend directory.");
        console.error("2. Add the following line to the .env file:");
        console.error(`\n   SERVICE_WALLET_MNEMONIC="${algosdk.secretKeyToMnemonic(newAccount.sk)}"\n`);
        console.error("3. Restart the backend server.");
        console.error("=".repeat(60));
        process.exit(1); // Exit if the mnemonic isn't set.
    }
    storageServiceAccount = algosdk.mnemonicToSecretKey(mnemonic);
    console.log(`[Backend] Storage Service Wallet loaded: ${storageServiceAccount.addr}`);
    console.log(`[Backend] This address will receive payments for storage upgrades.`);
}
catch (error) {
    console.error("\n[Backend] FATAL: Could not create account from SERVICE_WALLET_MNEMONIC.");
    console.error("Please ensure the mnemonic in your .env file is a valid 25-word phrase.");
    process.exit(1);
}
// --- FILE-BASED PERSISTENT DATABASE ---
let users = [];
let files = [];
let shares = [];
let folders = [];
let activities = []; // NEW: Activity Log storage
const saveDatabase = () => {
    try {
        const data = JSON.stringify({ users, files, shares, folders, activities }, null, 2);
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
            // Load activities, ensuring isRead defaults to true for old records
            activities = (db.activities || []).map((a) => ({ ...a, isRead: a.isRead !== undefined ? a.isRead : true }));
            console.log(`[Backend] Database loaded successfully from ${DB_FILE_PATH}.`);
        }
        else {
            // Create the file with empty arrays if it doesn't exist
            saveDatabase();
            console.log(`[Backend] New database file created at ${DB_FILE_PATH}.`);
        }
    }
    catch (error) {
        console.error('[Backend] CRITICAL: Failed to load database! Starting with empty state.', error);
        // Ensure arrays are in a clean state in case of partial load failure
        users = [];
        files = [];
        shares = [];
        folders = [];
        activities = [];
    }
};
// NEW: Helper to create an activity log
const createActivity = (owner, type, details, isRead = false) => {
    const newActivity = {
        _id: new Date().toISOString() + Math.random(),
        owner,
        type,
        details,
        timestamp: new Date().toISOString(),
        isRead,
    };
    activities.unshift(newActivity); // Add to the beginning of the list
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
            console.log(`[Backend] Recalculating storage for ${address.substring(0, 10)}... Old: ${user.storageUsed}, New: ${totalSize}`);
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
        user.storageUsed += size;
        // Log activity for the uploader (marked as read)
        createActivity(owner, 'UPLOAD', { filename, cid }, true);
        saveDatabase();
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
        const recursive = req.query.recursive === 'true';
        let ownedFiles = files.filter(f => f.owner === ownerAddress);
        let ownedFolders = folders.filter(f => f.owner === ownerAddress);
        if (!recursive) {
            ownedFiles = ownedFiles.filter(f => f.path === currentPath);
            ownedFolders = ownedFolders.filter(f => f.path === currentPath);
        }
        const sharedCids = shares.filter(s => s.recipientAddress === ownerAddress).map(s => s.cid);
        const sharedFiles = files.filter(f => sharedCids.includes(f.cid));
        const user = findOrCreateUser(ownerAddress);
        console.log(`[Backend] Found ${ownedFiles.length} files and ${ownedFolders.length} folders for owner ${ownerAddress.substring(0, 10)}... at path ${currentPath}`);
        res.status(200).json({
            files: ownedFiles,
            folders: ownedFolders,
            sharedFiles: sharedFiles,
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
            senderAddress: file.owner,
            recipientAddress,
            createdAt: new Date().toISOString(),
        };
        shares.push(newShare);
        // Log activity for the SENDER (marked as read)
        createActivity(file.owner, 'SHARE', { filename: file.filename, cid, recipient: recipientAddress }, true);
        // Log activity for the RECIPIENT (marked as unread)
        createActivity(recipientAddress, 'SHARE', { filename: file.filename, cid, recipient: 'You' }, false);
        saveDatabase();
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
        saveDatabase();
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
// 6. Delete a file (legacy - kept for reference)
apiRouter.delete('/files/:fileId', (req, res) => {
    try {
        const { fileId } = req.params;
        const { ownerAddress } = req.body;
        if (!fileId || !ownerAddress) {
            return res.status(400).json({ error: 'File ID and owner address are required.' });
        }
        const fileIndex = files.findIndex(f => f._id === fileId && f.owner === ownerAddress);
        if (fileIndex === -1) {
            return res.status(404).json({ error: 'File not found or you do not have permission to delete it.' });
        }
        const fileToDelete = files[fileIndex];
        const user = findOrCreateUser(ownerAddress);
        user.storageUsed -= fileToDelete.size;
        if (user.storageUsed < 0)
            user.storageUsed = 0;
        files.splice(fileIndex, 1);
        shares = shares.filter(s => s.cid !== fileToDelete.cid);
        createActivity(ownerAddress, 'DELETE', { filename: fileToDelete.filename }, true);
        saveDatabase();
        console.log(`[Backend] Deleted file with CID: ${fileToDelete.cid}`);
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
        const { name, owner, path, isLocked } = req.body;
        if (!name || !owner || path === undefined) {
            return res.status(400).json({ error: 'Folder name, owner, and path are required.' });
        }
        const existingFolder = folders.find(f => f.owner === owner && f.path === path && f.name === name);
        if (existingFolder) {
            return res.status(409).json({ error: `A folder named '${name}' already exists in this location.` });
        }
        const newFolder = {
            _id: new Date().toISOString() + Math.random(),
            name,
            owner,
            path,
            createdAt: new Date().toISOString(),
            isLocked: !!isLocked,
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
// 8. Move a file to a new path (Legacy)
apiRouter.put('/files/:fileId/move', (req, res) => {
    try {
        const { fileId } = req.params;
        const { ownerAddress, newPath } = req.body;
        if (!fileId || !ownerAddress || newPath === undefined) {
            return res.status(400).json({ error: 'File ID, owner address, and new path are required.' });
        }
        const fileToMove = files.find(f => f._id === fileId && f.owner === ownerAddress);
        if (!fileToMove) {
            return res.status(404).json({ error: 'File not found or you do not have permission to move it.' });
        }
        fileToMove.path = newPath;
        saveDatabase();
        console.log(`[Backend] Moved file ${fileToMove.cid} to path ${newPath}`);
        res.status(200).json({ message: 'File moved successfully.', file: fileToMove });
    }
    catch (error) {
        console.error('[Backend] Error moving file:', error);
        res.status(500).json({ error: 'Internal server error while moving file.' });
    }
});
// 9. Delete a folder (Legacy)
apiRouter.delete('/folders/:folderId', (req, res) => {
    try {
        const { folderId } = req.params;
        const { ownerAddress } = req.body;
        if (!folderId || !ownerAddress) {
            return res.status(400).json({ error: 'Folder ID and owner address are required.' });
        }
        const folderIndex = folders.findIndex(f => f._id === folderId && f.owner === ownerAddress);
        if (folderIndex === -1) {
            return res.status(404).json({ error: 'Folder not found or you do not have permission to delete it.' });
        }
        const folderToDelete = folders[folderIndex];
        const folderPath = `${folderToDelete.path}${folderToDelete.name}/`;
        const filesToDelete = files.filter(f => f.owner === ownerAddress && f.path.startsWith(folderPath));
        const subfoldersToDelete = folders.filter(f => f.owner === ownerAddress && f.path.startsWith(folderPath));
        let totalSizeDeleted = 0;
        filesToDelete.forEach(file => {
            totalSizeDeleted += file.size;
            shares = shares.filter(s => s.cid !== file.cid);
        });
        files = files.filter(f => !filesToDelete.find(fd => fd._id === f._id));
        folders = folders.filter(f => !subfoldersToDelete.find(fd => fd._id === f._id));
        folders.splice(folders.findIndex(f => f._id === folderId), 1);
        const user = findOrCreateUser(ownerAddress);
        user.storageUsed -= totalSizeDeleted;
        if (user.storageUsed < 0)
            user.storageUsed = 0;
        createActivity(ownerAddress, 'DELETE', { folderName: folderToDelete.name }, true);
        saveDatabase();
        console.log(`[Backend] Deleted folder '${folderToDelete.name}' and its contents for owner ${ownerAddress.substring(0, 10)}...`);
        res.status(200).json({ message: 'Folder and its contents deleted successfully.' });
    }
    catch (error) {
        console.error('[Backend] Error deleting folder:', error);
        res.status(500).json({ error: 'Internal server error while deleting folder.' });
    }
});
// 10. Rename a folder
apiRouter.put('/folders/:folderId/rename', (req, res) => {
    try {
        const { folderId } = req.params;
        const { ownerAddress, newName } = req.body;
        if (!folderId || !ownerAddress || !newName) {
            return res.status(400).json({ error: 'Folder ID, owner address, and new name are required.' });
        }
        const folderToRename = folders.find(f => f._id === folderId && f.owner === ownerAddress);
        if (!folderToRename) {
            return res.status(404).json({ error: 'Folder not found or you do not have permission to rename it.' });
        }
        const existingFolder = folders.find(f => f.owner === ownerAddress && f.path === folderToRename.path && f.name === newName);
        if (existingFolder) {
            return res.status(409).json({ error: `A folder named '${newName}' already exists in this location.` });
        }
        const oldPathPrefix = `${folderToRename.path}${folderToRename.name}/`;
        const newPathPrefix = `${folderToRename.path}${newName}/`;
        files.forEach(file => {
            if (file.owner === ownerAddress && file.path.startsWith(oldPathPrefix)) {
                file.path = file.path.replace(oldPathPrefix, newPathPrefix);
            }
        });
        folders.forEach(folder => {
            if (folder.owner === ownerAddress && folder.path.startsWith(oldPathPrefix)) {
                folder.path = folder.path.replace(oldPathPrefix, newPathPrefix);
            }
        });
        folderToRename.name = newName;
        saveDatabase();
        console.log(`[Backend] Renamed folder ${folderId} to ${newName}`);
        res.status(200).json({ message: 'Folder renamed successfully.', folder: folderToRename });
    }
    catch (error) {
        console.error('[Backend] Error renaming folder:', error);
        res.status(500).json({ error: 'Internal server error while renaming folder.' });
    }
});
// 11. Rename a file
apiRouter.put('/files/:fileId/rename', (req, res) => {
    try {
        const { fileId } = req.params;
        const { ownerAddress, newName } = req.body;
        if (!fileId || !ownerAddress || !newName) {
            return res.status(400).json({ error: 'File ID, owner address, and new name are required.' });
        }
        const fileToRename = files.find(f => f._id === fileId && f.owner === ownerAddress);
        if (!fileToRename) {
            return res.status(404).json({ error: 'File not found or you do not have permission to rename it.' });
        }
        const existingFile = files.find(f => f.owner === ownerAddress && f.path === fileToRename.path && f.filename === newName);
        if (existingFile) {
            return res.status(409).json({ error: `A file named '${newName}' already exists in this location.` });
        }
        fileToRename.filename = newName;
        saveDatabase();
        console.log(`[Backend] Renamed file ${fileToRename.cid} to ${newName}`);
        res.status(200).json({ message: 'File renamed successfully.', file: fileToRename });
    }
    catch (error) {
        console.error('[Backend] Error renaming file:', error);
        res.status(500).json({ error: 'Internal server error while renaming file.' });
    }
});
// 12. Move multiple items
apiRouter.put('/items/move', (req, res) => {
    try {
        const { ownerAddress, itemIds, itemTypes, newPath } = req.body;
        if (!ownerAddress || !itemIds || !itemTypes || newPath === undefined) {
            return res.status(400).json({ error: 'Owner, item IDs, item types, and new path are required.' });
        }
        const filesToMove = [];
        const foldersToMove = [];
        itemIds.forEach((id, index) => {
            if (itemTypes[index] === 'file') {
                const file = files.find(f => f._id === id && f.owner === ownerAddress);
                if (file)
                    filesToMove.push(file);
            }
            else if (itemTypes[index] === 'folder') {
                const folder = folders.find(f => f._id === id && f.owner === ownerAddress);
                if (folder)
                    foldersToMove.push(folder);
            }
        });
        filesToMove.forEach((file) => {
            console.log(`[Backend] Moving file ${file.filename} to ${newPath}`);
            file.path = newPath;
        });
        foldersToMove.forEach((folderToMove) => {
            const oldPathPrefix = `${folderToMove.path}${folderToMove.name}/`;
            const newName = folderToMove.name;
            const newPathPrefix = `${newPath}${newName}/`;
            console.log(`[Backend] Moving folder ${folderToMove.name} from ${folderToMove.path} to ${newPath}`);
            console.log(`[Backend] Descendant path change: ${oldPathPrefix} -> ${newPathPrefix}`);
            files.forEach((file) => {
                if (file.owner === ownerAddress && file.path.startsWith(oldPathPrefix)) {
                    const updatedPath = file.path.replace(oldPathPrefix, newPathPrefix);
                    console.log(`[Backend] ...updating file ${file.filename} path to ${updatedPath}`);
                    file.path = updatedPath;
                }
            });
            folders.forEach((folder) => {
                if (folder.owner === ownerAddress && folder.path.startsWith(oldPathPrefix)) {
                    const updatedPath = folder.path.replace(oldPathPrefix, newPathPrefix);
                    console.log(`[Backend] ...updating sub-folder ${folder.name} path to ${updatedPath}`);
                    folder.path = updatedPath;
                }
            });
            folderToMove.path = newPath;
        });
        saveDatabase();
        res.status(200).json({ message: 'Items moved successfully.' });
    }
    catch (error) {
        console.error('[Backend] Error moving items:', error);
        res.status(500).json({ error: 'Internal server error while moving items.' });
    }
});
// 13. Delete multiple items
apiRouter.post('/items/delete', (req, res) => {
    try {
        const { ownerAddress, itemIds } = req.body;
        if (!ownerAddress || !itemIds) {
            return res.status(400).json({ error: 'Owner and item IDs are required.' });
        }
        const user = findOrCreateUser(ownerAddress);
        let totalSizeDeleted = 0;
        const itemsToDelete = {
            files: new Set(),
            folders: new Set()
        };
        const initialFiles = files.filter(f => itemIds.includes(f._id));
        const initialFolders = folders.filter(f => itemIds.includes(f._id));
        initialFiles.forEach(f => itemsToDelete.files.add(f._id));
        initialFolders.forEach(f => itemsToDelete.folders.add(f._id));
        const foldersToScan = [...initialFolders];
        while (foldersToScan.length > 0) {
            const currentFolder = foldersToScan.pop();
            if (!currentFolder)
                continue;
            const currentPath = `${currentFolder.path}${currentFolder.name}/`;
            const subFolders = folders.filter(f => f.path === currentPath);
            subFolders.forEach(sub => {
                if (!itemsToDelete.folders.has(sub._id)) {
                    itemsToDelete.folders.add(sub._id);
                    foldersToScan.push(sub);
                }
            });
            const filesInFolder = files.filter(f => f.path.startsWith(currentPath));
            filesInFolder.forEach(file => itemsToDelete.files.add(file._id));
        }
        const deletedFilenames = [];
        files = files.filter(f => {
            if (itemsToDelete.files.has(f._id)) {
                totalSizeDeleted += f.size;
                shares = shares.filter(s => s.cid !== f.cid);
                deletedFilenames.push(f.filename);
                return false;
            }
            return true;
        });
        const deletedFolderNames = folders.filter(f => itemsToDelete.folders.has(f._id)).map(f => f.name);
        folders = folders.filter(f => !itemsToDelete.folders.has(f._id));
        user.storageUsed -= totalSizeDeleted;
        if (user.storageUsed < 0)
            user.storageUsed = 0;
        createActivity(ownerAddress, 'DELETE', { itemCount: deletedFilenames.length + deletedFolderNames.length }, true);
        saveDatabase();
        res.status(200).json({ message: 'Items deleted successfully.' });
    }
    catch (error) {
        console.error('[Backend] Error deleting items:', error);
        res.status(500).json({ error: 'Internal server error while deleting items.' });
    }
});
// 14. NEW: Get activity logs for a user
apiRouter.get('/activity/:ownerAddress', (req, res) => {
    try {
        const { ownerAddress } = req.params;
        let userActivities = activities.filter(a => a.owner === ownerAddress);
        userActivities = userActivities.map(activity => {
            if (activity.type === 'SHARE' && activity.details.recipient === 'You') {
                const shareInfo = shares.find(s => s.cid === activity.details.cid && s.recipientAddress === ownerAddress);
                return {
                    ...activity,
                    details: {
                        ...activity.details,
                        senderAddress: shareInfo?.senderAddress
                    }
                };
            }
            return activity;
        });
        const allUserActivities = userActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        res.status(200).json({ activities: allUserActivities });
    }
    catch (error) {
        console.error('[Backend] Error fetching activity:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});
// 15. NEW: Mark activities as read for a user
apiRouter.post('/activity/mark-read', (req, res) => {
    try {
        const { ownerAddress } = req.body;
        if (!ownerAddress) {
            return res.status(400).json({ error: 'Owner address is required.' });
        }
        let markedAsReadCount = 0;
        activities.forEach(activity => {
            if (activity.owner === ownerAddress && !activity.isRead) {
                activity.isRead = true;
                markedAsReadCount++;
            }
        });
        if (markedAsReadCount > 0) {
            saveDatabase();
        }
        console.log(`[Backend] Marked ${markedAsReadCount} notifications as read for ${ownerAddress.substring(0, 10)}...`);
        res.status(200).json({ message: 'Notifications marked as read.' });
    }
    catch (error) {
        console.error('[Backend] Error marking notifications as read:', error);
        res.status(500).json({ error: 'Internal server error.' });
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