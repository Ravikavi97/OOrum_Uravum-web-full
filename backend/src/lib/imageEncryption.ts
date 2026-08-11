/**
 * AES-256-CBC image encryption/decryption utility.
 *
 * Format of stored encrypted data (Buffer):
 *   [4 bytes: IV length (uint32 BE)] [16 bytes: IV] [N bytes: encrypted data]
 *
 * Key is derived from IMAGE_ENCRYPTION_KEY env var (must be 32 chars / 256 bits).
 * Falls back to a default dev key — ALWAYS set IMAGE_ENCRYPTION_KEY in production.
 */
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function getKey(): Buffer {
  const keyStr = process.env.IMAGE_ENCRYPTION_KEY || 'default-dev-key-32-chars-UNSAFE!!';
  if (keyStr.length < 32) {
    throw new Error('IMAGE_ENCRYPTION_KEY must be at least 32 characters');
  }
  return Buffer.from(keyStr.slice(0, 32), 'utf8');
}

/**
 * Encrypt image bytes.
 * Returns a Buffer: [4-byte IV-length header][16-byte IV][encrypted data]
 */
export function encryptImage(plainBytes: Buffer): Buffer {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainBytes), cipher.final()]);

  // Header: 4 bytes storing IV length (always 16, but explicit for future flexibility)
  const header = Buffer.alloc(4);
  header.writeUInt32BE(IV_LENGTH, 0);

  return Buffer.concat([header, iv, encrypted]);
}

/**
 * Decrypt image bytes previously encrypted with encryptImage().
 * Input must be the exact Buffer returned by encryptImage().
 */
export function decryptImage(encryptedBytes: Buffer | Uint8Array): Buffer {
  const buf = Buffer.isBuffer(encryptedBytes) ? encryptedBytes : Buffer.from(encryptedBytes);
  const key = getKey();

  // Read IV length from header
  const ivLength = buf.readUInt32BE(0);
  const iv = buf.slice(4, 4 + ivLength);
  const data = buf.slice(4 + ivLength);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

/**
 * Check if a buffer is encrypted (has our header format).
 * Used for backward-compatibility with existing unencrypted blobs.
 */
export function isEncrypted(bytes: Buffer | Uint8Array): boolean {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buf.length < 4) return false;
  const ivLength = buf.readUInt32BE(0);
  // Valid if IV length is 16 and total buffer is larger than header+IV
  return ivLength === IV_LENGTH && buf.length > 4 + ivLength;
}

/**
 * Safely decrypt — if buffer doesn't look encrypted (legacy data), return as-is.
 */
export function safeDecryptImage(bytes: Buffer | Uint8Array): Buffer {
  try {
    if (isEncrypted(bytes)) {
      return decryptImage(bytes);
    }
    // Legacy unencrypted blob — return raw
    return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  } catch {
    // Decryption failed — return raw (handles edge cases)
    return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  }
}
