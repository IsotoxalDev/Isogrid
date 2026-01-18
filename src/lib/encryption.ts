import CryptoJS from 'crypto-js';

const secretKey = process.env.ENCRYPTION_KEY;

if (!secretKey) {
  // In a real app, you might want to handle this more gracefully,
  // but for development, throwing an error is clear.
  console.error("ENCRYPTION_KEY is not set. Content will not be encrypted.");
}

// We'll use a fallback key for environments where the key might not be set,
// but we will log a warning. This is NOT recommended for production.
const key = secretKey || 'fallback-secret-key-for-development';
if (!secretKey) {
    console.warn("Warning: Using a fallback encryption key. This is not secure for production.");
}

export const encrypt = (text: string): string => {
  if (!text) return text;
  try {
    return CryptoJS.AES.encrypt(text, key).toString();
  } catch (e) {
    console.error("Encryption failed:", e);
    return text; // Return original text if encryption fails
  }
};

export const decrypt = (ciphertext: string): string => {
  if (!ciphertext) return ciphertext;
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    // If decryption results in an empty string, it's a failure.
    if (originalText.length === 0) {
      return ciphertext;
    }
    return originalText;
  } catch (e) {
    // This will catch errors like "Malformed UTF-8 data"
    // which happens when trying to decrypt plain text.
    // In this case, we just return the original text.
    return ciphertext;
  }
};
