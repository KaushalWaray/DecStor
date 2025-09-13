
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import algosdk from 'algosdk';
import { Collection, Db, MongoClient, ObjectId, WithId } from 'mongodb';
import speakeasy from 'speakeasy';
import crypto from 'crypto';
import multer from 'multer';
import FormData from 'form-data';
import { Readable } from 'stream';


// --- SELF-CONTAINED TYPE DEFINITIONS ---
export interface FileMetadata {
  _id: ObjectId;
  filename: string;
  cid: string;
  size: number;
  fileType: string;
  owner: string;
  createdAt: string;
  path: string; 
}

export interface Folder {
    _id: ObjectId;
    name: string;
    owner: string;
    path: string; 
    createdAt: string;
    isLocked?: boolean;
}

export interface Share {
  _id?: ObjectId;
  cid: string;
  senderAddress: string;
  recipientAddress: string;
  createdAt: string;
}

export interface User {
  _id: ObjectId;
  address: string;
  walletName: string;
  storageUsed: number;
  storageTier: 'free' | 'pro';
  createdAt: string;
  updatedAt: string;
  lastLogin: string;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  twoFactorVerified: boolean;
}

export interface Activity {
  _id: ObjectId;
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

export interface Contact {
  _id: ObjectId;
  owner: string;
  name: string;
  address: string;
  createdAt: string;
}
// --- END OF TYPE DEFINITIONS ---


// --- CONSTANTS ---
const FREE_TIER_LIMIT = 1 * 1024 * 1024; // 1 MB
const PRO_TIER_LIMIT = 100 * 1024 * 1024; // 100 MB
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'DecStor';
const PINATA_JWT = process.env.PINATA_JWT;


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
let contactsCollection: Collection<Contact>;

async function connectToDatabase() {
    try {
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        
        usersCollection = db.collection<User>('Wallets');
        filesCollection = db.collection<FileMetadata>('files');
        sharesCollection = db.collection<Share>('shares');
        foldersCollection = db.collection<Folder>('folders');
        activitiesCollection = db.collection<Activity>('activities');
        contactsCollection = db.collection<Contact>('contacts');

        // Create index on address for fast lookups
        await usersCollection.createIndex({ address: 1 }, { unique: true });
        await contactsCollection.createIndex({ owner: 1 });


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
    await activitiesCollection.insertOne(newActivity as Activity);
};

const getStorageLimit = (tier: 'free' | 'pro') => {
    return tier === 'pro' ? PRO_TIER_LIMIT : FREE_TIER_LIMIT;
};

const findOrCreateUser = async (address: string, walletName?: string): Promise<User & { storageLimit: number }> => {
    let user = await usersCollection.findOne({ address });
    const now = new Date().toISOString();

    if (user) {
        // --- Existing User Logic ---
        const aggregationResult = await filesCollection.aggregate([
            { $match: { owner: address } },
            { $group: { _id: null, totalSize: { $sum: "$size" } } }
        ]).toArray();

        const totalSize = aggregationResult.length > 0 ? aggregationResult[0].totalSize : 0;

        const updates: Partial<User> = {
            updatedAt: now,
            lastLogin: now,
        };

        if (user.storageUsed !== totalSize) {
            updates.storageUsed = totalSize;
            console.log(`[Backend] Recalculating storage for ${address.substring(0,10)}... Old: ${user.storageUsed}, New: ${totalSize}`);
        }
        
        await usersCollection.updateOne(
            { address }, 
            { $set: updates },
        );
        
        const updatedUser = await usersCollection.findOne({ address });
        if (!updatedUser) {
             throw new Error("Failed to update and retrieve user.");
        }
        user = updatedUser;

    } else {
        // --- New User Logic ---
        const defaultName = walletName || `Wallet ${address.substring(address.length - 4)}`;
        const newUser: Omit<User, '_id'> = {
            address,
            walletName: defaultName,
            storageUsed: 0,
            storageTier: 'free',
            createdAt: now,
            updatedAt: now,
            lastLogin: now,
            twoFactorEnabled: false,
            twoFactorVerified: false,
        };
        const insertResult = await usersCollection.insertOne(newUser as User);
        console.log(`[Backend] Created new user ${address.substring(0,10)}... with name "${defaultName}" and free tier.`);

        const createdUser = await usersCollection.findOne({ _id: insertResult.insertedId });
        if (!createdUser) {
            throw new Error("Failed to create and retrieve new user.");
        }
        user = createdUser;
    }
        
    return {
        ...user,
        storageLimit: getStorageLimit(user.storageTier),
    };
};


const app = express();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// For handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


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
        const { address, walletName } = req.body;
        if (!address) {
            return res.status(400).json({ error: 'Address is required.' });
        }
        const user = await findOrCreateUser(address, walletName);
        res.status(200).json({ user });
    } catch (error) {
        console.error('[Backend] Error finding or creating user:', error);
        res.status(500).json({ error: 'Internal server error while finding or creating user.' });
    }
});

// NEW: Rename a wallet
apiRouter.put('/users/:address/rename', async (req, res) => {
    try {
        const { address } = req.params;
        const { newName } = req.body;
        if (!newName) {
            return res.status(400).json({ error: 'New name is required.' });
        }

        const result = await usersCollection.updateOne(
            { address },
            { $set: { walletName: newName, updatedAt: new Date().toISOString() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const user = await usersCollection.findOne({ address });
        if (!user) {
            return res.status(404).json({ error: 'User not found after update.' });
        }
        
        console.log(`[Backend] Renamed wallet for ${address.substring(0,10)}... to "${newName}"`);
        res.status(200).json({ message: 'Wallet renamed successfully.', user });

    } catch (error) {
        console.error('[Backend] Error renaming wallet:', error);
        res.status(500).json({ error: 'Internal server error while renaming wallet.' });
    }
});


// NEW UPLOAD ENDPOINT
apiRouter.post('/files/upload', upload.single('file'), async (req, res) => {
    if (!PINATA_JWT) {
        return res.status(500).json({ error: 'Pinata JWT not configured on the server.' });
    }
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    try {
        const file = req.file;
        const formData = new FormData();
        
        const fileStream = Readable.from(file.buffer);
        formData.append('file', fileStream, { filename: file.originalname });

        const metadata = JSON.stringify({ name: file.originalname });
        formData.append('pinataMetadata', metadata);
        const options = JSON.stringify({ cidVersion: 0 });
        formData.append('pinataOptions', options);

        const pinataRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
            method: 'POST',
            headers: {
                ...formData.getHeaders(),
                Authorization: `Bearer ${PINATA_JWT}`,
            },
            body: formData as any,
        });

        if (!pinataRes.ok) {
            const errorBody = await pinataRes.json().catch(() => ({ error: pinataRes.statusText }));
            console.error('[Backend] Pinata API Error Response:', errorBody);
            throw new Error(`Pinata API Error: ${errorBody.error || pinataRes.statusText}`);
        }
        
        const pinataData = await pinataRes.json();
        res.status(200).json(pinataData);

    } catch (error) {
        console.error('[Backend] Error proxying file to Pinata:', error);
        res.status(500).json({ error: 'Internal server error during file upload.' });
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
            console.log(`[Backend] Quota exceeded for ${owner.substring(0,10)}...`);
            return res.status(413).json({
                error: 'Storage quota exceeded.',
                details: `You have used ${user.storageUsed} of ${storageLimit} bytes.`
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
        await usersCollection.updateOne({ address: owner }, { $inc: { storageUsed: size }, $set: { updatedAt: new Date().toISOString() } });
        
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

        const sharedCids = await sharesCollection.find({ recipientAddress: ownerAddress }).map((s: Share) => s.cid).toArray();
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

        const newShare: Omit<Share, '_id'> = {
            cid,
            senderAddress: file.owner,
            recipientAddress,
            createdAt: new Date().toISOString(),
        };
        await sharesCollection.insertOne(newShare as Share);

        await createActivity(file.owner, 'SHARE', { filename: file.filename, cid, recipient: recipientAddress }, true);
        await createActivity(recipientAddress, 'SHARE', { filename: file.filename, cid, recipient: 'You' }, false);
        
        console.log(`[Backend] Shared CID ${cid} with ${recipientAddress}`);
        res.status(201).json({ message: 'File shared successfully.', share: newShare });

    } catch (error) {
        console.error('[Backend] Error sharing file:', error);
        res.status(500).json({ error: 'Internal server error while sharing file.' });
    }
});

// NEW: Get all shares made BY a user
apiRouter.get('/shares/:ownerAddress', async (req, res) => {
    try {
        const { ownerAddress } = req.params;
        const sentShares = await sharesCollection.find({ senderAddress: ownerAddress }).toArray();

        const fileCids = sentShares.map(s => s.cid);
        const files = await filesCollection.find({ cid: { $in: fileCids } }).toArray();
        const fileMap = new Map(files.map(f => [f.cid, f]));

        const results = sentShares.map(share => {
            const file = fileMap.get(share.cid);
            return {
                ...share,
                filename: file?.filename,
                fileType: file?.fileType,
            };
        });
        
        res.status(200).json({ shares: results });

    } catch(error) {
        console.error('[Backend] Error fetching sent shares:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});


// 5. Confirm a payment and upgrade user's storage
apiRouter.post('/payment/confirm', async (req, res) => {
    try {
        const { senderAddress, txId, recipientAddress, amount } = req.body;
        if (!senderAddress || !txId || !recipientAddress || amount === undefined) {
            return res.status(400).json({ error: 'Sender address, recipient, amount, and transaction ID are required.' });
        }

        console.log(`[Backend] Received payment confirmation for tx: ${txId.substring(0,10)}... from ${senderAddress.substring(0,10)}...`);
        
        // This logic is specifically for the storage upgrade flow
        if (amount === 0.1 && recipientAddress === storageServiceAccount.addr) {
            await usersCollection.updateOne({ address: senderAddress }, { $set: { storageTier: 'pro', updatedAt: new Date().toISOString() } });
            console.log(`[Backend] Upgraded ${senderAddress.substring(0,10)}... to Pro tier.`);
        }
        
        // This is generic activity logging for ANY payment confirmation received
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

        await filesCollection.updateMany(
            { owner: ownerAddress, path: { $regex: `^${oldPathPrefix}` } },
            [{ $set: { path: { $replaceOne: { input: "$path", find: oldPathPrefix, replacement: newPathPrefix } } } }]
        );
        
        await foldersCollection.updateMany(
            { owner: ownerAddress, path: { $regex: `^${oldPathPrefix}` } },
            [{ $set: { path: { $replaceOne: { input: "$path", find: oldPathPrefix, replacement: newPathPrefix } } } }]
        );

        await foldersCollection.updateOne({ _id: folderToRename._id }, { $set: { name: newName } });

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
        
        const fileIds = itemIds.filter((id: string, i: number) => itemTypes[i] === 'file').map((id: string) => new ObjectId(id));
        const folderIds = itemIds.filter((id: string, i: number) => itemTypes[i] === 'folder').map((id: string) => new ObjectId(id));

        await filesCollection.updateMany({ _id: { $in: fileIds } }, { $set: { path: newPath } });

        const foldersToMove = await foldersCollection.find({ _id: { $in: folderIds } }).toArray();

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
            
            await foldersCollection.updateOne({ _id: folderToMove._id }, { $set: { path: newPath } });
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

        const objectItemIds = itemIds.map((id:string) => new ObjectId(id));

        const filesToDeleteIds = new Set<string>();
        const foldersToDeleteIds = new Set<string>();

        const initialFiles = await filesCollection.find({ _id: { $in: objectItemIds }, owner: ownerAddress }).toArray();
        const initialFolders = await foldersCollection.find({ _id: { $in: objectItemIds }, owner: ownerAddress }).toArray();

        initialFiles.forEach((f: FileMetadata) => filesToDeleteIds.add(f._id.toString()));
        initialFolders.forEach((f: Folder) => foldersToDeleteIds.add(f._id.toString()));

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
            filesInFolder.forEach((file: FileMetadata) => filesToDeleteIds.add(file._id.toString()));
        }
        
        const finalFileIdsToDelete = Array.from(filesToDeleteIds).map(id => new ObjectId(id));
        const finalFolderIdsToDelete = Array.from(foldersToDeleteIds).map(id => new ObjectId(id));

        const filesToDeleteResult = await filesCollection.find({ _id: { $in: finalFileIdsToDelete } }).toArray();
        let totalSizeDeleted = filesToDeleteResult.reduce((sum, file) => sum + file.size, 0);

        const cidsToDelete = filesToDeleteResult.map((f: FileMetadata) => f.cid);

        await filesCollection.deleteMany({ _id: { $in: finalFileIdsToDelete } });
        await foldersCollection.deleteMany({ _id: { $in: finalFolderIdsToDelete } });
        await sharesCollection.deleteMany({ cid: { $in: cidsToDelete } });
        
        await usersCollection.updateOne({ address: ownerAddress }, { $inc: { storageUsed: -totalSizeDeleted } });
        
        await createActivity(ownerAddress, 'DELETE', { itemCount: finalFileIdsToDelete.length + finalFolderIdsToDelete.length }, true);

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


// === NEW: CONTACTS API ===

// 16. Get all contacts for a user
apiRouter.get('/contacts/:ownerAddress', async (req, res) => {
    try {
        const { ownerAddress } = req.params;
        const contacts = await contactsCollection.find({ owner: ownerAddress }).sort({ name: 1 }).toArray();
        res.status(200).json({ contacts });
    } catch (error) {
        console.error('[Backend] Error fetching contacts:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// 17. Create a new contact
apiRouter.post('/contacts', async (req, res) => {
    try {
        const { owner, name, address } = req.body;
        if (!owner || !name || !address) {
            return res.status(400).json({ error: 'Owner, name, and address are required.' });
        }
        
        if (!algosdk.isValidAddress(address)) {
            return res.status(400).json({ error: 'Invalid Algorand address provided.' });
        }

        const existingContact = await contactsCollection.findOne({ owner, address });
        if (existingContact) {
            return res.status(409).json({ error: 'A contact with this address already exists.' });
        }

        const newContact: Omit<Contact, '_id'> = {
            owner,
            name,
            address,
            createdAt: new Date().toISOString(),
        };

        const result = await contactsCollection.insertOne(newContact as Contact);
        res.status(201).json({ message: 'Contact created successfully.', contact: { ...newContact, _id: result.insertedId } });
    } catch (error) {
        console.error('[Backend] Error creating contact:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// 18. Update a contact
apiRouter.put('/contacts/:contactId', async (req, res) => {
    try {
        const { contactId } = req.params;
        const { owner, name, address } = req.body;

        if (!owner || !name || !address) {
            return res.status(400).json({ error: 'Owner, name, and address are required.' });
        }

        const result = await contactsCollection.updateOne(
            { _id: new ObjectId(contactId), owner: owner },
            { $set: { name, address } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Contact not found or you do not have permission to edit it.' });
        }

        res.status(200).json({ message: 'Contact updated successfully.' });
    } catch (error) {
        console.error('[Backend] Error updating contact:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});


// 19. Delete a contact
apiRouter.delete('/contacts/:contactId', async (req, res) => {
    try {
        const { contactId } = req.params;
        const { owner } = req.body; // Owner must be passed in body for verification

        if (!owner) {
             return res.status(400).json({ error: 'Owner is required for deletion.' });
        }

        const result = await contactsCollection.deleteOne({ _id: new ObjectId(contactId), owner: owner });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Contact not found or you do not have permission to delete it.' });
        }
        res.status(200).json({ message: 'Contact deleted successfully.' });
    } catch (error) {
        console.error('[Backend] Error deleting contact:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// === NEW: 2FA API ===

// 20. Generate a 2FA secret
apiRouter.post('/2fa/generate', async (req, res) => {
    try {
        const { address, walletName } = req.body;
        if (!address) return res.status(400).json({ error: 'Address is required.' });

        const secret = speakeasy.generateSecret({
            name: `DecStor (${walletName})`,
            issuer: 'DecStor'
        });

        // Store the unverified secret in the user's document
        await usersCollection.updateOne(
            { address },
            { $set: { twoFactorSecret: secret.base32, twoFactorVerified: false } }
        );

        // Return the QR code data URL and the manual setup key
        res.status(200).json({
            otpauth_url: secret.otpauth_url,
            secret: secret.base32,
        });

    } catch (error) {
        console.error('[Backend] Error generating 2FA secret:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// 21. Verify a 2FA token and enable 2FA
apiRouter.post('/2fa/verify', async (req, res) => {
    try {
        const { address, token } = req.body;
        if (!address || !token) {
            return res.status(400).json({ error: 'Address and token are required.' });
        }
        
        const user = await usersCollection.findOne({ address });
        if (!user || !user.twoFactorSecret) {
            return res.status(404).json({ error: '2FA secret not found for this user.' });
        }

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: token,
        });
        
        if (verified) {
            await usersCollection.updateOne(
                { address },
                { $set: { twoFactorEnabled: true, twoFactorVerified: true } }
            );
            console.log(`[Backend] 2FA enabled for ${address.substring(0,10)}...`);
            res.status(200).json({ verified: true, message: '2FA has been enabled successfully!' });
        } else {
            res.status(401).json({ verified: false, message: 'Invalid token. Please try again.' });
        }

    } catch (error) {
        console.error('[Backend] Error verifying 2FA token:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// 22. Disable 2FA
apiRouter.post('/2fa/disable', async (req, res) => {
    try {
        const { address, token } = req.body;
         if (!address || !token) {
            return res.status(400).json({ error: 'Address and token are required to disable 2FA.' });
        }
        
        const user = await usersCollection.findOne({ address });
        if (!user || !user.twoFactorSecret || !user.twoFactorEnabled) {
            return res.status(400).json({ error: '2FA is not enabled for this user.' });
        }

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: token,
        });

        if (verified) {
            await usersCollection.updateOne(
                { address },
                { $set: { twoFactorEnabled: false, twoFactorSecret: undefined, twoFactorVerified: false } }
            );
            console.log(`[Backend] 2FA disabled for ${address.substring(0,10)}...`);
            res.status(200).json({ message: '2FA has been disabled.' });
        } else {
            res.status(401).json({ message: 'Invalid token. Verification failed.' });
        }

    } catch (error) {
        console.error('[Backend] Error disabling 2FA:', error);
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

  