import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import algosdk from 'algosdk';
import { MongoClient, ObjectId } from 'mongodb';
// --- END OF TYPE DEFINITIONS ---
// --- CONSTANTS ---
const FREE_TIER_LIMIT = 1 * 1024 * 1024; // 1 MB
const PRO_TIER_LIMIT = 100 * 1024 * 1024; // 100 MB
const PORT = 3001;
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'DecStor';
// --- DATABASE CONNECTION ---
if (!MONGO_URI) {
    console.error("\n[Backend] FATAL: MONGO_URI is not set in the .env file.");
    console.error("Please add your MongoDB connection string to backend/.env");
    process.exit(1);
}
const mongoClient = new MongoClient(MONGO_URI);
let db;
let usersCollection;
let filesCollection;
let sharesCollection;
let foldersCollection;
let activitiesCollection;
async function connectToDatabase() {
    try {
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        usersCollection = db.collection('Wallets');
        filesCollection = db.collection('files');
        sharesCollection = db.collection('shares');
        foldersCollection = db.collection('folders');
        activitiesCollection = db.collection('activities');
        // Create index on address for fast lookups
        await usersCollection.createIndex({ address: 1 }, { unique: true });
        console.log(`[Backend] Successfully connected to MongoDB database: ${db.databaseName}`);
    }
    catch (error) {
        console.error('[Backend] CRITICAL: Failed to connect to MongoDB!', error);
        process.exit(1);
    }
}
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
// --- HELPER FUNCTIONS ---
const createActivity = async (owner, type, details, isRead = false) => {
    const newActivity = {
        owner,
        type,
        details,
        timestamp: new Date().toISOString(),
        isRead,
    };
    await activitiesCollection.insertOne(newActivity);
};
const getStorageLimit = (tier) => {
    return tier === 'pro' ? PRO_TIER_LIMIT : FREE_TIER_LIMIT;
};
const findOrCreateUser = async (address) => {
    const user = await usersCollection.findOne({ address });
    const now = new Date().toISOString();
    if (user) {
        // --- Existing User Logic ---
        const aggregationResult = await filesCollection.aggregate([
            { $match: { owner: address } },
            { $group: { _id: null, totalSize: { $sum: "$size" } } }
        ]).toArray();
        const totalSize = aggregationResult.length > 0 ? aggregationResult[0].totalSize : 0;
        const updates = {
            updatedAt: now,
            lastLogin: now,
        };
        if (user.storageUsed !== totalSize) {
            updates.storageUsed = totalSize;
            console.log(`[Backend] Recalculating storage for ${address.substring(0, 10)}... Old: ${user.storageUsed}, New: ${totalSize}`);
        }
        const result = await usersCollection.findOneAndUpdate({ address }, { $set: updates }, { returnDocument: 'after' });
        if (!result) {
            // This should ideally not happen if user was found, but it's good practice to check
            throw new Error("Failed to update and retrieve user.");
        }
        return {
            ...result,
            storageLimit: getStorageLimit(result.storageTier),
        };
    }
    else {
        // --- New User Logic ---
        const newUser = {
            address,
            storageUsed: 0,
            storageTier: 'free',
            createdAt: now,
            updatedAt: now,
            lastLogin: now,
        };
        const insertResult = await usersCollection.insertOne(newUser);
        console.log(`[Backend] Created new user ${address.substring(0, 10)}... with free tier.`);
        const createdUser = await usersCollection.findOne({ _id: insertResult.insertedId });
        if (!createdUser) {
            throw new Error("Failed to create and retrieve new user.");
        }
        return {
            ...createdUser,
            storageLimit: getStorageLimit(createdUser.storageTier),
        };
    }
};
const app = express();
// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
// --- API ROUTER ---
const apiRouter = express.Router();
// 1. Health Check
apiRouter.get('/', (req, res) => {
    res.status(200).json({
        message: 'Backend is running and connected!',
        database: db ? 'Connected' : 'Disconnected'
    });
});
apiRouter.get('/service-address', (req, res) => {
    res.status(200).json({ address: storageServiceAccount.addr });
});
// NEW: Endpoint to ensure a user exists upon wallet import/creation
apiRouter.post('/users/find-or-create', async (req, res) => {
    try {
        const { address } = req.body;
        if (!address) {
            return res.status(400).json({ error: 'Address is required.' });
        }
        const user = await findOrCreateUser(address);
        res.status(200).json({ user });
    }
    catch (error) {
        console.error('[Backend] Error finding or creating user:', error);
        res.status(500).json({ error: 'Internal server error while finding or creating user.' });
    }
});
// 2. Save File Metadata
apiRouter.post('/files/metadata', async (req, res) => {
    try {
        const { filename, cid, size, fileType, owner, path } = req.body;
        if (!filename || !cid || !size || !fileType || !owner || path === undefined) {
            return res.status(400).json({ error: 'Missing required file metadata.' });
        }
        const user = await findOrCreateUser(owner);
        const storageLimit = getStorageLimit(user.storageTier);
        if (user.storageUsed + size > storageLimit) {
            console.log(`[Backend] Quota exceeded for ${owner.substring(0, 10)}...`);
            return res.status(413).json({
                error: 'Storage quota exceeded.',
                details: `You have used ${user.storageUsed} of ${storageLimit} bytes.`
            });
        }
        const newFile = {
            filename,
            cid,
            size,
            fileType,
            owner,
            path,
            createdAt: new Date().toISOString(),
        };
        const result = await filesCollection.insertOne(newFile);
        await usersCollection.updateOne({ address: owner }, { $inc: { storageUsed: size }, $set: { updatedAt: new Date().toISOString() } });
        await createActivity(owner, 'UPLOAD', { filename, cid }, true);
        console.log(`[Backend] Saved metadata for CID: ${cid} at path ${path}`);
        res.status(201).json({ message: 'Metadata saved successfully.', file: { ...newFile, _id: result.insertedId } });
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
        const recursive = req.query.recursive === 'true';
        let ownedFilesQuery = recursive ? { owner: ownerAddress } : { owner: ownerAddress, path: req.query.path || '/' };
        let ownedFoldersQuery = recursive ? { owner: ownerAddress } : { owner: ownerAddress, path: req.query.path || '/' };
        const ownedFiles = await filesCollection.find(ownedFilesQuery).toArray();
        const ownedFolders = await foldersCollection.find(ownedFoldersQuery).toArray();
        const sharedCids = await sharesCollection.find({ recipientAddress: ownerAddress }).map((s) => s.cid).toArray();
        const sharedFiles = await filesCollection.find({ cid: { $in: sharedCids } }).toArray();
        const user = await findOrCreateUser(ownerAddress);
        console.log(`[Backend] Found ${ownedFiles.length} files and ${ownedFolders.length} folders for owner ${ownerAddress.substring(0, 10)}... at path ${ownedFilesQuery.path || '(recursive)'}`);
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
        const file = await filesCollection.findOne({ cid });
        if (!file) {
            return res.status(404).json({ error: 'File not found.' });
        }
        const existingShare = await sharesCollection.findOne({ cid, recipientAddress });
        if (existingShare) {
            return res.status(200).json({ message: 'File already shared with this user.' });
        }
        const newShare = {
            cid,
            senderAddress: file.owner,
            recipientAddress,
            createdAt: new Date().toISOString(),
        };
        await sharesCollection.insertOne(newShare);
        await createActivity(file.owner, 'SHARE', { filename: file.filename, cid, recipient: recipientAddress }, true);
        await createActivity(recipientAddress, 'SHARE', { filename: file.filename, cid, recipient: 'You' }, false);
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
        const { senderAddress, txId, recipientAddress, amount } = req.body;
        if (!senderAddress || !txId) {
            return res.status(400).json({ error: 'Sender address and transaction ID are required.' });
        }
        console.log(`[Backend] Received payment confirmation for tx: ${txId.substring(0, 10)}... from ${senderAddress.substring(0, 10)}...`);
        if (amount === 0.1 && recipientAddress === storageServiceAccount.addr) {
            await usersCollection.updateOne({ address: senderAddress }, { $set: { storageTier: 'pro', updatedAt: new Date().toISOString() } });
            console.log(`[Backend] Upgraded ${senderAddress.substring(0, 10)}... to Pro tier.`);
        }
        await createActivity(senderAddress, 'SEND_ALGO', { recipient: recipientAddress, amount }, true);
        await createActivity(recipientAddress, 'RECEIVE_ALGO', { sender: senderAddress, amount }, false);
        // Fetch the updated user to return the new storage limit
        const user = await findOrCreateUser(senderAddress);
        res.status(200).json({
            message: "Payment confirmed and storage updated successfully!",
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
// 7. Create a new folder
apiRouter.post('/folders', async (req, res) => {
    try {
        const { name, owner, path, isLocked } = req.body;
        if (!name || !owner || path === undefined) {
            return res.status(400).json({ error: 'Folder name, owner, and path are required.' });
        }
        const existingFolder = await foldersCollection.findOne({ owner, path, name });
        if (existingFolder) {
            return res.status(409).json({ error: `A folder named '${name}' already exists in this location.` });
        }
        const newFolder = {
            name,
            owner,
            path,
            createdAt: new Date().toISOString(),
            isLocked: !!isLocked,
        };
        const result = await foldersCollection.insertOne(newFolder);
        console.log(`[Backend] Created folder '${name}' at path '${path}' for owner ${owner.substring(0, 10)}...`);
        res.status(201).json({ message: 'Folder created successfully.', folder: { ...newFolder, _id: result.insertedId } });
    }
    catch (error) {
        console.error('[Backend] Error creating folder:', error);
        res.status(500).json({ error: 'Internal server error while creating folder.' });
    }
});
// 10. Rename a folder
apiRouter.put('/folders/:folderId/rename', async (req, res) => {
    try {
        const { folderId } = req.params;
        const { ownerAddress, newName } = req.body;
        if (!folderId || !ownerAddress || !newName) {
            return res.status(400).json({ error: 'Folder ID, owner address, and new name are required.' });
        }
        const folderToRename = await foldersCollection.findOne({ _id: new ObjectId(folderId), owner: ownerAddress });
        if (!folderToRename) {
            return res.status(404).json({ error: 'Folder not found or you do not have permission to rename it.' });
        }
        const existingFolder = await foldersCollection.findOne({ owner: ownerAddress, path: folderToRename.path, name: newName });
        if (existingFolder) {
            return res.status(409).json({ error: `A folder named '${newName}' already exists in this location.` });
        }
        const oldPathPrefix = `${folderToRename.path}${folderToRename.name}/`;
        const newPathPrefix = `${folderToRename.path}${newName}/`;
        await filesCollection.updateMany({ owner: ownerAddress, path: { $regex: `^${oldPathPrefix}` } }, [{ $set: { path: { $replaceOne: { input: "$path", find: oldPathPrefix, replacement: newPathPrefix } } } }]);
        await foldersCollection.updateMany({ owner: ownerAddress, path: { $regex: `^${oldPathPrefix}` } }, [{ $set: { path: { $replaceOne: { input: "$path", find: oldPathPrefix, replacement: newPathPrefix } } } }]);
        await foldersCollection.updateOne({ _id: folderToRename._id }, { $set: { name: newName } });
        console.log(`[Backend] Renamed folder ${folderId} to ${newName}`);
        res.status(200).json({ message: 'Folder renamed successfully.', folder: { ...folderToRename, name: newName } });
    }
    catch (error) {
        console.error('[Backend] Error renaming folder:', error);
        res.status(500).json({ error: 'Internal server error while renaming folder.' });
    }
});
// 11. Rename a file
apiRouter.put('/files/:fileId/rename', async (req, res) => {
    try {
        const { fileId } = req.params;
        const { ownerAddress, newName } = req.body;
        if (!fileId || !ownerAddress || !newName) {
            return res.status(400).json({ error: 'File ID, owner address, and new name are required.' });
        }
        const fileToRename = await filesCollection.findOne({ _id: new ObjectId(fileId), owner: ownerAddress });
        if (!fileToRename) {
            return res.status(404).json({ error: 'File not found or you do not have permission to rename it.' });
        }
        const existingFile = await filesCollection.findOne({ owner: ownerAddress, path: fileToRename.path, filename: newName });
        if (existingFile) {
            return res.status(409).json({ error: `A file named '${newName}' already exists in this location.` });
        }
        await filesCollection.updateOne({ _id: fileToRename._id }, { $set: { filename: newName } });
        console.log(`[Backend] Renamed file ${fileToRename.cid} to ${newName}`);
        res.status(200).json({ message: 'File renamed successfully.', file: { ...fileToRename, filename: newName } });
    }
    catch (error) {
        console.error('[Backend] Error renaming file:', error);
        res.status(500).json({ error: 'Internal server error while renaming file.' });
    }
});
// 12. Move multiple items
apiRouter.put('/items/move', async (req, res) => {
    try {
        const { ownerAddress, itemIds, itemTypes, newPath } = req.body;
        if (!ownerAddress || !itemIds || !itemTypes || newPath === undefined) {
            return res.status(400).json({ error: 'Owner, item IDs, item types, and new path are required.' });
        }
        const fileIds = itemIds.filter((id, i) => itemTypes[i] === 'file').map((id) => new ObjectId(id));
        const folderIds = itemIds.filter((id, i) => itemTypes[i] === 'folder').map((id) => new ObjectId(id));
        await filesCollection.updateMany({ _id: { $in: fileIds } }, { $set: { path: newPath } });
        const foldersToMove = await foldersCollection.find({ _id: { $in: folderIds } }).toArray();
        for (const folderToMove of foldersToMove) {
            const oldPathPrefix = `${folderToMove.path}${folderToMove.name}/`;
            const newName = folderToMove.name;
            const newPathPrefix = `${newPath}${newName}/`;
            await filesCollection.updateMany({ owner: ownerAddress, path: { $regex: `^${oldPathPrefix}` } }, [{ $set: { path: { $replaceOne: { input: "$path", find: oldPathPrefix, replacement: newPathPrefix } } } }]);
            await foldersCollection.updateMany({ owner: ownerAddress, path: { $regex: `^${oldPathPrefix}` } }, [{ $set: { path: { $replaceOne: { input: "$path", find: oldPathPrefix, replacement: newPathPrefix } } } }]);
            await foldersCollection.updateOne({ _id: folderToMove._id }, { $set: { path: newPath } });
        }
        res.status(200).json({ message: 'Items moved successfully.' });
    }
    catch (error) {
        console.error('[Backend] Error moving items:', error);
        res.status(500).json({ error: 'Internal server error while moving items.' });
    }
});
// 13. Delete multiple items
apiRouter.post('/items/delete', async (req, res) => {
    try {
        const { ownerAddress, itemIds } = req.body;
        if (!ownerAddress || !itemIds) {
            return res.status(400).json({ error: 'Owner and item IDs are required.' });
        }
        const objectItemIds = itemIds.map((id) => new ObjectId(id));
        const filesToDeleteIds = new Set();
        const foldersToDeleteIds = new Set();
        const initialFiles = await filesCollection.find({ _id: { $in: objectItemIds }, owner: ownerAddress }).toArray();
        const initialFolders = await foldersCollection.find({ _id: { $in: objectItemIds }, owner: ownerAddress }).toArray();
        initialFiles.forEach((f) => filesToDeleteIds.add(f._id.toString()));
        initialFolders.forEach((f) => foldersToDeleteIds.add(f._id.toString()));
        const foldersToScan = [...initialFolders];
        while (foldersToScan.length > 0) {
            const currentFolder = foldersToScan.pop();
            if (!currentFolder)
                continue;
            const currentPath = `${currentFolder.path}${currentFolder.name}/`;
            const subFolders = await foldersCollection.find({ path: currentPath, owner: ownerAddress }).toArray();
            for (const sub of subFolders) {
                if (!foldersToDeleteIds.has(sub._id.toString())) {
                    foldersToDeleteIds.add(sub._id.toString());
                    foldersToScan.push(sub);
                }
            }
            const filesInFolder = await filesCollection.find({ path: { $regex: `^${currentPath}` }, owner: ownerAddress }).toArray();
            filesInFolder.forEach((file) => filesToDeleteIds.add(file._id.toString()));
        }
        const finalFileIdsToDelete = Array.from(filesToDeleteIds).map(id => new ObjectId(id));
        const finalFolderIdsToDelete = Array.from(foldersToDeleteIds).map(id => new ObjectId(id));
        const filesToDeleteResult = await filesCollection.find({ _id: { $in: finalFileIdsToDelete } }).toArray();
        let totalSizeDeleted = filesToDeleteResult.reduce((sum, file) => sum + file.size, 0);
        const cidsToDelete = filesToDeleteResult.map((f) => f.cid);
        await filesCollection.deleteMany({ _id: { $in: finalFileIdsToDelete } });
        await foldersCollection.deleteMany({ _id: { $in: finalFolderIdsToDelete } });
        await sharesCollection.deleteMany({ cid: { $in: cidsToDelete } });
        await usersCollection.updateOne({ address: ownerAddress }, { $inc: { storageUsed: -totalSizeDeleted } });
        await createActivity(ownerAddress, 'DELETE', { itemCount: finalFileIdsToDelete.length + finalFolderIdsToDelete.length }, true);
        res.status(200).json({ message: 'Items deleted successfully.' });
    }
    catch (error) {
        console.error('[Backend] Error deleting items:', error);
        res.status(500).json({ error: 'Internal server error while deleting items.' });
    }
});
// 14. Get activity logs for a user
apiRouter.get('/activity/:ownerAddress', async (req, res) => {
    try {
        const { ownerAddress } = req.params;
        let userActivities = await activitiesCollection.find({ owner: ownerAddress }).sort({ timestamp: -1 }).toArray();
        for (let i = 0; i < userActivities.length; i++) {
            let activity = userActivities[i];
            if (activity.type === 'SHARE' && activity.details.recipient === 'You') {
                const shareInfo = await sharesCollection.findOne({ cid: activity.details.cid, recipientAddress: ownerAddress });
                activity.details.senderAddress = shareInfo?.senderAddress;
            }
            else if (activity.type === 'RECEIVE_ALGO') {
                activity.details.senderAddress = activity.details.sender;
            }
        }
        res.status(200).json({ activities: userActivities });
    }
    catch (error) {
        console.error('[Backend] Error fetching activity:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});
// 15. Mark activities as read for a user
apiRouter.post('/activity/mark-read', async (req, res) => {
    try {
        const { ownerAddress } = req.body;
        if (!ownerAddress) {
            return res.status(400).json({ error: 'Owner address is required.' });
        }
        const result = await activitiesCollection.updateMany({ owner: ownerAddress, isRead: false }, { $set: { isRead: true } });
        console.log(`[Backend] Marked ${result.modifiedCount} notifications as read for ${ownerAddress.substring(0, 10)}...`);
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
const startServer = async () => {
    await connectToDatabase();
    app.listen(PORT, () => {
        console.log(`✅ Backend service listening at http://localhost:${PORT}`);
    });
};
startServer();
//# sourceMappingURL=index.js.map