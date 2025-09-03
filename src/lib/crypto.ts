
"use client";

// This file implements strong, standard-based cryptography using the Web Crypto API.
// It uses AES-GCM, a widely recommended authenticated encryption cipher.

const SALT = "metadrive-salt"; // A constant salt for key derivation
const IV_LENGTH = 12; // 12 bytes for GCM is recommended

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

    // Combine IV and ciphertext for storage, then base64-encode
    const combinedBuffer = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combinedBuffer.set(iv, 0);
    combinedBuffer.set(new Uint8Array(encryptedBuffer), iv.length);

    return btoa(String.fromCharCode.apply(null, Array.from(combinedBuffer)));
}

/**
 * Decrypts the mnemonic phrase using the user's PIN.
 * @param {string} encryptedDataB64 Base64-encoded string of IV + ciphertext.
 * @param {string} pin The user's PIN.
 * @returns {Promise<string>} The original mnemonic phrase.
 */
export async function decryptMnemonic(encryptedDataB64: string, pin: string): Promise<string> {
    const key = await getKey(pin);
    
    // Decode from base64 and split the IV from the ciphertext
    const combinedBuffer = new Uint8Array(Array.from(atob(encryptedDataB64)).map(char => char.charCodeAt(0)));
    const iv = combinedBuffer.slice(0, IV_LENGTH);
    const ciphertext = combinedBuffer.slice(IV_LENGTH);

    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        ciphertext
    );

    return new TextDecoder().decode(decryptedBuffer);
}
