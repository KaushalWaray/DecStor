// IMPORTANT: This is a placeholder for demonstration and is NOT secure.
// For a production application, use a robust, standard cryptographic library like Web Crypto API.

// A simple reversible transformation using the PIN
async function transform(data: string, pin: string): Promise<string> {
  const textEncoder = new TextEncoder();
  const dataBytes = textEncoder.encode(data);
  const pinBytes = textEncoder.encode(pin);
  const resultBytes = new Uint8Array(dataBytes.length);

  for (let i = 0; i < dataBytes.length; i++) {
    resultBytes[i] = dataBytes[i] ^ pinBytes[i % pinBytes.length];
  }

  // Convert bytes to a base64 string to store in localStorage
  return btoa(String.fromCharCode.apply(null, Array.from(resultBytes)));
}

export async function encryptMnemonic(mnemonic: string, pin: string): Promise<string> {
  return transform(mnemonic, pin);
}

export async function decryptMnemonic(encryptedMnemonic: string, pin: string): Promise<string> {
  // Convert base64 string back to bytes
  const encryptedBytes = new Uint8Array(Array.from(atob(encryptedMnemonic)).map(char => char.charCodeAt(0)));
  const pinBytes = new TextEncoder().encode(pin);
  const resultBytes = new Uint8Array(encryptedBytes.length);
  
  for (let i = 0; i < encryptedBytes.length; i++) {
    resultBytes[i] = encryptedBytes[i] ^ pinBytes[i % pinBytes.length];
  }

  return new TextDecoder().decode(resultBytes);
}
