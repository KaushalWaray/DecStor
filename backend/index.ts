
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import algosdk from 'algosdk';
import { Collection, Db, MongoClient } from 'mongodb';

// --- SELF-CONTAINED TYPE DEFINITIONS ---
export interface FileMetadata {
  _id: string;
  filename: string;
  cid: string;
  size: number;
  fileType: string;
  owner: string;
  createdAt: string;
  path: string; 
}

export interface Folder {
    _id: string;
    name: string;
    owner: string;
    path: string; 
    createdAt: string;
    isLocked?: boolean;
}

export interface Share {
  cid: string;
  senderAddress: string;
  recipientAddress: string;
  createdAt: string;
}

export interface User {
    address: string;
    storageLimit: number;
    storageUsed: number;
}

export interface Activity {
  _id: string;
  type: 'UPLOAD' | 'SHARE' | 'DELETE' | 'SEND_ALGO' | 'RECEIVE_ALGO';
  owner: string;
  timestamp: string;
  details: {
    filename?: string;
    folderName?: string;
    cid?: string;
    recipient?: string;
    itemCount?: number;
    amount?: number;
    sender?: string;
    senderAddress?: string; // Explicitly adding for consistency
  };
  isRead: boolean;
}
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
let db: Db;
let usersCollection: Collection<User>;
let filesCollection: Collection<FileMetadata>;
let sharesCollection: Collection<Share>;
let foldersCollection: Collection<Folder>;
let activitiesCollection: Collection<Activity>;

async function connectToDatabase() {
    try {
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        
        usersCollection = db.collection<User>('Wallets');
        filesCollection = db.collection<FileMetadata>('files');
        sharesCollection = db.collection<Share>('shares');
        foldersCollection = db.collection<Folder>('folders');
        activitiesCollection = db.collection<Activity>('activities');

        console.log(`[Backend] Successfully connected to MongoDB database: ${db.databaseName}`);
    } catch (error) {
        console.error('[Backend] CRITICAL: Failed to connect to MongoDB!', error);
        process.exit(1);
    }
}


// --- PERSISTENT SERVICE WALLET ---
let storageServiceAccount: algosdk.Account;

try {
    const mnemonic = process.env.SERVICE_WALLET_MNEMONIC;
    if (!mnemonic) {
        const newAccount = algosdk.generateAccount();
        console.error("\n[Backend] FATAL: SERVICE_WALLET_MNEMONIC not set in environment.");
        console.error("=".repeat(60));
        console.error("A new wallet has been generated for you. Please take action:")
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
} catch (error) {
    console.error("\n[Backend] FATAL: Could not create account from SERVICE_WALLET_MNEMONIC.");
    console.error("Please ensure the mnemonic in your .env file is a valid 25-word phrase.");
    process.exit(1);
}


// --- HELPER FUNCTIONS ---
const createActivity = async (owner: string, type: Activity['type'], details: Activity['details'], isRead: boolean = false) => {
    const newActivity: Omit<Activity, '_id'> = {
        owner,
        type,
        details,
        timestamp: new Date().toISOString(),
        isRead,
    };
    // Insert at the database level. No more local array.
    await activitiesCollection.insertOne(newActivity as Activity);
};

const findOrCreateUser = async (address: string): Promise<User> => {
    let user = await usersCollection.findOne({ address });

    if (!user) {
        user = {
            address,
            storageLimit: FREE_TIER_LIMIT,
            storageUsed: 0,
        };
        await usersCollection.insertOne(user);
        console.log(`[Backend] Created new user ${address.substring(0,10)}... with free tier.`);
    } else {
        const userFiles = await filesCollection.find({ owner: address }).toArray();
        const totalSize = userFiles.reduce((acc, file) => acc + file.size, 0);
        
        if(user.storageUsed !== totalSize) {
            console.log(`[Backend] Recalculating storage for ${address.substring(0,10)}... Old: ${user.storageUsed}, New: ${totalSize}`);
            await usersCollection.updateOne({ address }, { $set: { storageUsed: totalSize } });
            user.storageUsed = totalSize;
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
    res.status(200).json({ 
        message: 'Backend is running and connected!',
        database: db ? 'Connected' : 'Disconnected'
    });
});

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
        
        const user = await findOrCreateUser(owner);
        if (user.storageUsed + size > user.storageLimit) {
            console.log(`[Backend] Quota exceeded for ${owner.substring(0,10)}...`);
            return res.status(413).json({
                error: 'Storage quota exceeded.',
                details: `You have used ${user.storageUsed} of ${user.storageLimit} bytes.`
            });
        }
        
        const newFile: Omit<FileMetadata, '_id'> = {
            filename,
            cid,
            size,
            fileType,
            owner,
            path,
            createdAt: new Date().toISOString(),
        };

        const result = await filesCollection.insertOne(newFile as FileMetadata);
        await usersCollection.updateOne({ address: owner }, { $inc: { storageUsed: size } });
        
        await createActivity(owner, 'UPLOAD', { filename, cid }, true);
        
        console.log(`[Backend] Saved metadata for CID: ${cid} at path ${path}`);
        res.status(201).json({ message: 'Metadata saved successfully.', file: { ...newFile, _id: result.insertedId } });

    } catch (error) {
        console.error('[Backend] Error saving metadata:', error);
        res.status(500).json({ error: 'Internal server error while saving metadata.' });
    }
});

// 3. Get Files and Folders by Owner and Path
apiRouter.get('/files/:ownerAddress', async (req, res) => {
    try {
        const { ownerAddress } = req.params;
        const recursive = (req.query.recursive as string) === 'true';

        let ownedFilesQuery = recursive ? { owner: ownerAddress } : { owner: ownerAddress, path: (req.query.path as string) || '/' };
        let ownedFoldersQuery = recursive ? { owner: ownerAddress } : { owner: ownerAddress, path: (req.query.path as string) || '/' };

        const ownedFiles = await filesCollection.find(ownedFilesQuery).toArray();
        const ownedFolders = await foldersCollection.find(ownedFoldersQuery).toArray();

        const sharedCids = await sharesCollection.find({ recipientAddress: ownerAddress }).map(s => s.cid).toArray();
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

        const file = await filesCollection.findOne({ cid });
        if (!file) {
            return res.status(404).json({ error: 'File not found.' });
        }

        const existingShare = await sharesCollection.findOne({ cid, recipientAddress });
        if (existingShare) {
            return res.status(200).json({ message: 'File already shared with this user.' });
        }

        const newShare: Share = {
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

    } catch (error) {
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

        console.log(`[Backend] Received payment confirmation for tx: ${txId.substring(0,10)}... from ${senderAddress.substring(0,10)}...`);

        const user = await findOrCreateUser(senderAddress);
        
        if (amount === 0.1 && recipientAddress === storageServiceAccount.addr) {
            await usersCollection.updateOne({ address: senderAddress }, { $set: { storageLimit: PRO_TIER_LIMIT } });
            user.storageLimit = PRO_TIER_LIMIT;
            console.log(`[Backend] Upgraded ${user.address.substring(0,10)}... to Pro tier.`);
        }
        
        await createActivity(senderAddress, 'SEND_ALGO', { recipient: recipientAddress, amount }, true);
        await createActivity(recipientAddress, 'RECEIVE_ALGO', { sender: senderAddress, amount }, false);

        res.status(200).json({
            message: "Payment confirmed and storage updated successfully!",
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


// 7. Create a new folder
apiRouter.post('/folders', async (req, res) => {
    try {
        const { name, owner, path, isLocked } = req.body;
        if (!name || !owner || path === undefined) {
            return res.status(400).json({ error: 'Folder name, owner, and path are required.' });
        }

        const existingFolder = await foldersCollection.findOne({ owner, path, name });
        if(existingFolder) {
            return res.status(409).json({ error: `A folder named '${name}' already exists in this location.`});
        }
        
        const newFolder: Omit<Folder, '_id'> = {
            name,
            owner,
            path,
            createdAt: new Date().toISOString(),
            isLocked: !!isLocked,
        };

        const result = await foldersCollection.insertOne(newFolder as Folder);
        
        console.log(`[Backend] Created folder '${name}' at path '${path}' for owner ${owner.substring(0,10)}...`);
        res.status(201).json({ message: 'Folder created successfully.', folder: {...newFolder, _id: result.insertedId} });

    } catch (error) {
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

        const folderToRename = await foldersCollection.findOne({ _id: folderId as any, owner: ownerAddress });
        if (!folderToRename) {
            return res.status(404).json({ error: 'Folder not found or you do not have permission to rename it.' });
        }

        const existingFolder = await foldersCollection.findOne({ owner: ownerAddress, path: folderToRename.path, name: newName });
        if (existingFolder) {
            return res.status(409).json({ error: `A folder named '${newName}' already exists in this location.` });
        }
        
        const oldPathPrefix = `${folderToRename.path}${folderToRename.name}/`;
        const newPathPrefix = `${folderToRename.path}${newName}/`;

        await filesCollection.updateMany(
            { owner: ownerAddress, path: { $regex: `^${oldPathPrefix}` } },
            [{ $set: { path: { $replaceOne: { input: "$path", find: oldPathPrefix, replacement: newPathPrefix } } } }]
        );
        
        await foldersCollection.updateMany(
            { owner: ownerAddress, path: { $regex: `^${oldPathPrefix}` } },
            [{ $set: { path: { $replaceOne: { input: "$path", find: oldPathPrefix, replacement: newPathPrefix } } } }]
        );

        await foldersCollection.updateOne({ _id: folderToRename._id as any }, { $set: { name: newName } });

        console.log(`[Backend] Renamed folder ${folderId} to ${newName}`);
        res.status(200).json({ message: 'Folder renamed successfully.', folder: { ...folderToRename, name: newName } });
    } catch (error) {
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

        const fileToRename = await filesCollection.findOne({ _id: fileId as any, owner: ownerAddress });
        if (!fileToRename) {
            return res.status(404).json({ error: 'File not found or you do not have permission to rename it.' });
        }

        const existingFile = await filesCollection.findOne({ owner: ownerAddress, path: fileToRename.path, filename: newName });
        if (existingFile) {
            return res.status(409).json({ error: `A file named '${newName}' already exists in this location.` });
        }

        await filesCollection.updateOne({ _id: fileToRename._id as any }, { $set: { filename: newName } });
        
        console.log(`[Backend] Renamed file ${fileToRename.cid} to ${newName}`);
        res.status(200).json({ message: 'File renamed successfully.', file: { ...fileToRename, filename: newName } });
        
    } catch(error) {
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
        
        const fileIds = itemIds.filter((id: string, i: number) => itemTypes[i] === 'file');
        const folderIds = itemIds.filter((id: string, i: number) => itemTypes[i] === 'folder');

        await filesCollection.updateMany({ _id: { $in: fileIds.map((id:string) => id as any) } }, { $set: { path: newPath } });

        const foldersToMove = await foldersCollection.find({ _id: { $in: folderIds.map((id:string) => id as any) } }).toArray();

        for (const folderToMove of foldersToMove) {
            const oldPathPrefix = `${folderToMove.path}${folderToMove.name}/`;
            const newName = folderToMove.name;
            const newPathPrefix = `${newPath}${newName}/`;
            
            await filesCollection.updateMany(
                { owner: ownerAddress, path: { $regex: `^${oldPathPrefix}` } },
                [{ $set: { path: { $replaceOne: { input: "$path", find: oldPathPrefix, replacement: newPathPrefix } } } }]
            );

            await foldersCollection.updateMany(
                { owner: ownerAddress, path: { $regex: `^${oldPathPrefix}` } },
                [{ $set: { path: { $replaceOne: { input: "$path", find: oldPathPrefix, replacement: newPathPrefix } } } }]
            );
            
            await foldersCollection.updateOne({ _id: folderToMove._id as any }, { $set: { path: newPath } });
        }

        res.status(200).json({ message: 'Items moved successfully.' });
        
    } catch(error) {
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

        const filesToDeleteIds = new Set<string>();
        const foldersToDeleteIds = new Set<string>();

        const initialFiles = await filesCollection.find({ _id: { $in: itemIds.map((id:string) => id as any) }, owner: ownerAddress }).toArray();
        const initialFolders = await foldersCollection.find({ _id: { $in: itemIds.map((id:string) => id as any) }, owner: ownerAddress }).toArray();

        initialFiles.forEach(f => filesToDeleteIds.add(f._id.toString()));
        initialFolders.forEach(f => foldersToDeleteIds.add(f._id.toString()));

        const foldersToScan = [...initialFolders];
        while(foldersToScan.length > 0) {
            const currentFolder = foldersToScan.pop();
            if (!currentFolder) continue;

            const currentPath = `${currentFolder.path}${currentFolder.name}/`;
            
            const subFolders = await foldersCollection.find({ path: currentPath, owner: ownerAddress }).toArray();
            for(const sub of subFolders) {
                if (!foldersToDeleteIds.has(sub._id.toString())) {
                    foldersToDeleteIds.add(sub._id.toString());
                    foldersToScan.push(sub);
                }
            }

            const filesInFolder = await filesCollection.find({ path: { $regex: `^${currentPath}` }, owner: ownerAddress }).toArray();
            filesInFolder.forEach(file => filesToDeleteIds.add(file._id.toString()));
        }

        const filesToDeleteResult = await filesCollection.find({ _id: { $in: Array.from(filesToDeleteIds).map(id => id as any) } }).toArray();
        let totalSizeDeleted = filesToDeleteResult.reduce((sum, file) => sum + file.size, 0);

        const cidsToDelete = filesToDeleteResult.map(f => f.cid);

        await filesCollection.deleteMany({ _id: { $in: Array.from(filesToDeleteIds).map(id => id as any) } });
        await foldersCollection.deleteMany({ _id: { $in: Array.from(foldersToDeleteIds).map(id => id as any) } });
        await sharesCollection.deleteMany({ cid: { $in: cidsToDelete } });
        
        await usersCollection.updateOne({ address: ownerAddress }, { $inc: { storageUsed: -totalSizeDeleted } });
        
        await createActivity(ownerAddress, 'DELETE', { itemCount: filesToDeleteIds.size + foldersToDeleteIds.size }, true);

        res.status(200).json({ message: 'Items deleted successfully.' });

    } catch (error) {
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
            } else if (activity.type === 'RECEIVE_ALGO') {
                activity.details.senderAddress = activity.details.sender;
            }
        }
        
        res.status(200).json({ activities: userActivities });
    } catch(error) {
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
        
        const result = await activitiesCollection.updateMany(
            { owner: ownerAddress, isRead: false },
            { $set: { isRead: true } }
        );
        
        console.log(`[Backend] Marked ${result.modifiedCount} notifications as read for ${ownerAddress.substring(0,10)}...`);
        res.status(200).json({ message: 'Notifications marked as read.' });

    } catch (error) {
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
    

    