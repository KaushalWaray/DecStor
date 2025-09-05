
"use client";

// This file implements strong, standard-based cryptography using the Web Crypto API.
// It uses AES-GCM, a widely recommended authenticated encryption cipher.

const SALT = "metadrive-salt"; // A constant salt for key derivation
const IV_LENGTH = 12; // 12 bytes for GCM is recommended


// --- NEW: Robust Base64 conversion for ArrayBuffers ---
// The old btoa/atob method can corrupt binary data. These functions are safe.

function bufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

// --- END of new helpers ---


/**
 * Derives a 256-bit AES key from a user's PIN using PBKDF2.
 * The salt is hardcoded for this application's scope.
 * @param {string} pin The user's PIN.
 * @returns {Promise<CryptoKey>} A cryptographic key for AES-GCM.
 */
async function getKey(pin: string): Promise<CryptoKey> {
    const textEncoder = new TextEncoder();
    const pinBuffer = textEncoder.encode(pin);
    const saltBuffer = textEncoder.encode(SALT);

    // Derive a key from the PIN using PBKDF2
    const masterKey = await crypto.subtle.importKey(
        "raw",
        pinBuffer,
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    return await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: saltBuffer,
            iterations: 100000,
            hash: "SHA-256",
        },
        masterKey,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

/**
 * Encrypts the user's mnemonic phrase with their PIN.
 * Generates a random Initialization Vector (IV) for each encryption.
 * @param {string} mnemonic The 25-word mnemonic phrase.
 * @param {string} pin The user's PIN.
 * @returns {Promise<string>} A base64-encoded string containing the IV and ciphertext.
 */
export async function encryptMnemonic(mnemonic: string, pin: string): Promise<string> {
    const key = await getKey(pin);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const mnemonicBuffer = new TextEncoder().encode(mnemonic);

    const encryptedBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        mnemonicBuffer
    );

    // Combine IV and ciphertext for storage
    const combinedBuffer = new ArrayBuffer(iv.length + encryptedBuffer.byteLength);
    const combinedView = new Uint8Array(combinedBuffer);
    combinedView.set(iv, 0);
    combinedView.set(new Uint8Array(encryptedBuffer), iv.length);
    
    // Use the robust function to convert the combined buffer to a Base64 string
    return bufferToBase64(combinedBuffer);
}

/**
 * Decrypts the mnemonic phrase using the user's PIN.
 * @param {string} encryptedDataB64 Base64-encoded string of IV + ciphertext.
 * @param {string} pin The user's PIN.
 * @returns {Promise<string>} The original mnemonic phrase.
 */
export async function decryptMnemonic(encryptedDataB64: string, pin: string): Promise<string> {
    try {
        const key = await getKey(pin);
        
        // Use the robust function to convert Base64 string back to a buffer
        const combinedBuffer = base64ToBuffer(encryptedDataB64);

        const iv = new Uint8Array(combinedBuffer.slice(0, IV_LENGTH));
        const ciphertext = new Uint8Array(combinedBuffer.slice(IV_LENGTH));

        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            key,
            ciphertext
        );

        return new TextDecoder().decode(decryptedBuffer);
    } catch (error) {
        console.error("Decryption failed:", error);
        // Throw a specific error to be caught by the UI
        throw new Error("Decryption failed. The PIN may be incorrect or the data may be corrupt.");
    }
}

/**
 * A wrapper to create an account object from a mnemonic.
 * @param {string} mnemonic The 25-word mnemonic.
 * @returns {{addr: string, sk: Uint8Array}} The account object.
 */
 export function mnemonicToAccount(mnemonic: string) {
    const { "addr": address, "sk": secretKey } = algosdk.mnemonicToSecretKey(mnemonic);
    return { addr: address, sk: secretKey, mnemonic };
}

/**
 * Encrypts a file using the user's PIN.
 * @param {File} file The file to encrypt.
 * @param {string} pin The user's PIN.
 * @returns {Promise<File>} A new File object with encrypted content.
 */
export async function encryptFile(file: File, pin: string): Promise<File> {
    const key = await getKey(pin);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const fileBuffer = await file.arrayBuffer();

    const encryptedBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        fileBuffer
    );

    // Combine IV and ciphertext
    const combinedBuffer = new ArrayBuffer(iv.length + encryptedBuffer.byteLength);
    const combinedView = new Uint8Array(combinedBuffer);
    combinedView.set(iv, 0);
    combinedView.set(new Uint8Array(encryptedBuffer), iv.length);

    // Return a new File object with the encrypted content
    return new File([combinedBuffer], file.name, { type: 'application/octet-stream' });
}


/**
 * Decrypts a file using the user's PIN.
 * @param {Blob} encryptedBlob The encrypted file content as a Blob.
 * @param {string} pin The user's PIN.
 * @returns {Promise<Blob>} The decrypted file content as a Blob.
 */
export async function decryptFile(encryptedBlob: Blob, pin: string): Promise<Blob> {
    try {
        const key = await getKey(pin);
        const combinedBuffer = await encryptedBlob.arrayBuffer();

        const iv = new Uint8Array(combinedBuffer.slice(0, IV_LENGTH));
        const ciphertext = new Uint8Array(combinedBuffer.slice(IV_LENGTH));

        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            key,
            ciphertext
        );
        
        // The original file type isn't stored with the encrypted data, so we return a generic blob.
        // The browser can often infer the type from the filename extension upon download.
        return new Blob([decryptedBuffer]);

    } catch (error) {
        console.error("File decryption failed:", error);
        throw new Error("File decryption failed. The PIN may be incorrect or the data is corrupt.");
    }
}
