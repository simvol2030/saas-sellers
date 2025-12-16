/**
 * Loyalty QR Code Validator
 *
 * Validates QR codes with signature verification, decryption, and expiry checks.
 */

import crypto from 'crypto';

export interface ValidatedQRData {
  type: 'card' | 'transaction' | 'coupon' | 'referral';
  [key: string]: any;
}

export interface ValidationOptions {
  secretKey: string;
  maxAge?: number; // Max age in seconds (for transaction QR)
}

/**
 * Decrypt payload using AES-256-GCM
 */
function decryptPayload(encryptedBase64: string, secretKey: string): string {
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(secretKey, 'salt', 32);

  const combined = Buffer.from(encryptedBase64, 'base64');

  // Extract: iv(16) + authTag(16) + encrypted
  const iv = combined.slice(0, 16);
  const authTag = combined.slice(16, 32);
  const encrypted = combined.slice(32);

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}

/**
 * Verify HMAC-SHA256 signature (timing-safe)
 */
function verifySignature(data: string, signature: string, secretKey: string): boolean {
  const expected = crypto.createHmac('sha256', secretKey).update(data).digest('hex');

  if (signature.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  );
}

/**
 * Validate loyalty QR code
 *
 * @throws Error if validation fails
 */
export async function validateQR(
  qrData: string,
  options: ValidationOptions
): Promise<ValidatedQRData> {
  // 1. Parse format
  const parts = qrData.split(':');

  if (parts.length !== 5) {
    throw new Error('Invalid QR format');
  }

  const [prefix, version, type, encryptedPayload, signature] = parts;

  // 2. Validate prefix and version
  if (prefix !== 'loyalty') {
    throw new Error('Invalid QR prefix');
  }

  if (version !== 'v1') {
    throw new Error('Unsupported QR version: ' + version);
  }

  // 3. Validate type
  const validTypes = ['card', 'transaction', 'coupon', 'referral'];
  if (!validTypes.includes(type)) {
    throw new Error('Invalid QR type: ' + type);
  }

  // 4. Verify signature BEFORE decrypting
  const dataToSign = prefix + ':' + version + ':' + type + ':' + encryptedPayload;

  if (!verifySignature(dataToSign, signature, options.secretKey)) {
    throw new Error('Invalid signature - QR may be tampered');
  }

  // 5. Decrypt payload
  let payload: any;
  try {
    const decrypted = decryptPayload(encryptedPayload, options.secretKey);
    payload = JSON.parse(decrypted);
  } catch (error) {
    throw new Error('Failed to decrypt QR payload');
  }

  // 6. Check expiry
  if (payload.expiresAt) {
    const expiresAt = new Date(payload.expiresAt);
    const now = new Date();

    if (now > expiresAt) {
      const secondsAgo = Math.round((now.getTime() - expiresAt.getTime()) / 1000);
      throw new Error('QR code expired ' + secondsAgo + 's ago');
    }
  }

  // 7. Check max age (for transaction QR)
  if (options.maxAge && payload.issuedAt) {
    const issuedAt = new Date(payload.issuedAt);
    const age = (Date.now() - issuedAt.getTime()) / 1000;

    if (age > options.maxAge) {
      throw new Error('QR code too old (' + Math.round(age) + 's > ' + options.maxAge + 's)');
    }
  }

  // Return validated data
  return {
    type: type as any,
    ...payload
  };
}
