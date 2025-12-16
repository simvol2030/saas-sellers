/**
 * Loyalty QR Code Generator
 *
 * Generates secure QR codes with AES-256-GCM encryption and HMAC-SHA256 signatures.
 * Supports multiple QR types: card, transaction, coupon, referral.
 */

import crypto from 'crypto';
import QRCode from 'qrcode';

export interface QRGeneratorOptions {
  type: 'card' | 'transaction' | 'coupon' | 'referral';
  secretKey: string;
  
  // Card type
  cardNumber?: string;
  customerId?: string;
  tier?: string;
  
  // Transaction type
  transactionId?: string;
  amount?: number;
  points?: number;
  storeId?: string;
  
  // Coupon type
  couponCode?: string;
  discountPercent?: number;
  minPurchase?: number;
  
  // Referral type
  referrerId?: string;
  referralCode?: string;
  bonusPoints?: number;
  
  // Common options
  expiresAt?: Date;
  oneTimeUse?: boolean;
  useToken?: string;
  
  // QR image options
  size?: number; // Default 256
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'; // Default 'M'
}

/**
 * Encrypt payload using AES-256-GCM
 */
function encryptPayload(payload: object, secretKey: string): string {
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(secretKey, 'salt', 32);
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  // Combine: iv(16) + authTag(16) + encrypted
  const combined = Buffer.concat([iv, authTag, encrypted]);

  return combined.toString('base64');
}

/**
 * Generate HMAC-SHA256 signature
 */
function generateSignature(data: string, secretKey: string): string {
  return crypto.createHmac('sha256', secretKey).update(data).digest('hex');
}

/**
 * Build payload based on QR type
 */
function buildPayload(options: QRGeneratorOptions): object {
  const base: any = {};

  if (options.expiresAt) {
    base.expiresAt = options.expiresAt.toISOString();
  }

  if (options.oneTimeUse) {
    base.oneTimeUse = true;
    base.useToken = options.useToken;
  }

  switch (options.type) {
    case 'card':
      return {
        ...base,
        cardNumber: options.cardNumber,
        customerId: options.customerId,
        tier: options.tier,
        issuedAt: new Date().toISOString()
      };

    case 'transaction':
      return {
        ...base,
        transactionId: options.transactionId,
        amount: options.amount,
        points: options.points,
        storeId: options.storeId
      };

    case 'coupon':
      return {
        ...base,
        couponCode: options.couponCode,
        discountPercent: options.discountPercent,
        minPurchase: options.minPurchase
      };

    case 'referral':
      return {
        ...base,
        referrerId: options.referrerId,
        referralCode: options.referralCode,
        bonusPoints: options.bonusPoints
      };

    default:
      throw new Error(`Unsupported QR type: ${options.type}`);
  }
}

/**
 * Generate loyalty QR code
 *
 * Returns data URL: "data:image/png;base64,iVBORw0KG..."
 */
export async function generateLoyaltyQR(options: QRGeneratorOptions): Promise<string> {
  // Build payload
  const payload = buildPayload(options);

  // Encrypt payload
  const encryptedPayload = encryptPayload(payload, options.secretKey);

  // Build QR data string
  const prefix = 'loyalty';
  const version = 'v1';
  const dataToSign = `${prefix}:${version}:${options.type}:${encryptedPayload}`;

  // Generate signature
  const signature = generateSignature(dataToSign, options.secretKey);

  // Final QR data
  const qrData = `${dataToSign}:${signature}`;

  // Generate QR code image
  const qrDataURL = await QRCode.toDataURL(qrData, {
    width: options.size || 256,
    margin: 4,
    errorCorrectionLevel: options.errorCorrectionLevel || 'M'
  });

  return qrDataURL;
}

/**
 * Example usage:
 *
 * ```typescript
 * import { generateLoyaltyQR } from './qr_generator';
 *
 * // Generate card QR
 * const cardQR = await generateLoyaltyQR({
 *   type: 'card',
 *   cardNumber: 'LC-123456',
 *   customerId: 'user-guid-123',
 *   tier: 'gold',
 *   secretKey: process.env.QR_SECRET_KEY!
 * });
 *
 * // Use in img tag: <img src={cardQR} alt="QR Code" />
 * ```
 */
