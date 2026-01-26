import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

/**
 * Derive encryption key from the encryption key and salt using PBKDF2
 */
function deriveKey(encryptionKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    encryptionKey,
    salt,
    100000, // iterations
    KEY_LENGTH,
    'sha256'
  );
}

/**
 * Encrypts data using AES-256-GCM
 * Returns a base64-encoded string containing salt, iv, auth tag, and encrypted data
 */
export function encrypt(data: string, encryptionKey: string): string {
  // Validate encryption key
  if (!encryptionKey || encryptionKey.length !== 64) {
    throw new Error('Invalid encryption key. Must be 64-character hex string.');
  }

  // Generate salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  // Derive key from encryption key and salt
  const key = deriveKey(encryptionKey, salt);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt data
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get auth tag
  const authTag = cipher.getAuthTag();

  // Combine salt + iv + auth tag + encrypted data
  const combined = Buffer.concat([salt, iv, authTag, Buffer.from(encrypted, 'hex')]);

  return combined.toString('base64');
}

/**
 * Decrypts data that was encrypted with the encrypt function
 */
export function decrypt(encryptedData: string, encryptionKey: string): string {
  // Validate encryption key
  if (!encryptionKey || encryptionKey.length !== 64) {
    throw new Error('Invalid encryption key. Must be 64-character hex string.');
  }

  // Decode base64
  const combined = Buffer.from(encryptedData, 'base64');

  // Extract components
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = combined.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  );
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  // Derive key from encryption key and salt
  const key = deriveKey(encryptionKey, salt);

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  // Decrypt data
  const decryptedBuffer = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  const decrypted = decryptedBuffer.toString('utf8');

  return decrypted;
}

/**
 * Validates if a string is a valid 64-character hex string
 */
export function isValidEncryptionKey(key: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(key);
}
