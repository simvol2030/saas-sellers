---
name: loyalty-qr-system
description: Production-ready QR code system for loyalty programs. Use when generating QR codes for loyalty cards, transactions, coupons, or referrals with encryption (AES-256), expiry times, and anti-fraud protection. Covers QR generation with signatures, scanning via Telegram WebApp showScanQrPopup(), validation with HMAC verification, data format standards, one-time use tokens, and fallback to manual input.
---

# Loyalty QR System

## Overview

This skill provides production-ready patterns for implementing QR code functionality in loyalty programs. It covers secure QR generation with encryption, scanning through Telegram WebApp API, validation with cryptographic signatures, and anti-fraud measures.

Use this skill when:
- Generating QR codes for loyalty cards (customer identification)
- Creating transaction QR codes for cashier scanning (points redemption/accrual)
- Generating coupon/promo QR codes with expiry times
- Creating referral QR codes for customer acquisition
- Scanning QR codes via Telegram's native scanner
- Validating scanned QR data on backend (signature verification)
- Implementing one-time use QR codes (payment, check-in)
- Handling QR security (encryption, tampering prevention)
- Building fallback mechanisms for QR scanning failures

## Core Capabilities

### 1. QR Code Generation

Generate secure QR codes with encryption and digital signatures.

**Basic Generation:**

Refer to `scripts/qr_generator.ts` for complete implementation.

```typescript
import { generateLoyaltyQR } from './scripts/qr_generator';

// Generate loyalty card QR
const cardQR = await generateLoyaltyQR({
  type: 'card',
  cardNumber: 'LC-123456',
  customerId: 'user-guid-123',
  secretKey: process.env.QR_SECRET_KEY
});

// Returns data URL: "data:image/png;base64,iVBORw0KG..."
// Display in <img src={cardQR} />
```

**QR Generation with Expiry:**

```typescript
// Generate transaction QR (expires in 5 minutes)
const transactionQR = await generateLoyaltyQR({
  type: 'transaction',
  transactionId: 'tx-789',
  amount: 1000,
  points: 100,
  expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min
  secretKey: process.env.QR_SECRET_KEY
});
```

**One-Time Use QR:**

```typescript
// Generate one-time coupon QR
const couponQR = await generateLoyaltyQR({
  type: 'coupon',
  couponCode: 'SAVE20',
  discountPercent: 20,
  oneTimeUse: true,
  useToken: crypto.randomBytes(16).toString('hex'), // Unique token
  expiresAt: new Date('2025-12-31'),
  secretKey: process.env.QR_SECRET_KEY
});
```

**QR Generation Options:**

- **Size**: Default 256x256px, adjustable (128-1024px)
- **Error Correction**: Medium (default) - can scan even if 15% damaged
- **Margin**: 4 modules (white border around QR)
- **Color**: Configurable foreground/background colors

**Best Practices:**
- Always include signature for tamper detection
- Use expiry times for transaction/coupon QR codes
- Generate unique tokens for one-time use QR codes
- Store QR metadata in database (generation time, usage count)
- Rotate secret keys periodically

---

### 2. QR Code Scanning (Telegram)

Scan QR codes using Telegram's native scanner via WebApp API.

**Implementation:**

Refer to `scripts/qr_scanner.ts` for complete implementation.

```typescript
import { scanQRCode } from './scripts/qr_scanner';

// Scan QR code via Telegram
try {
  const qrData = await scanQRCode({
    text: 'Отсканируйте QR-код карты лояльности'
  });

  // Parse and validate
  const parsed = await validateQR(qrData);

  if (parsed.type === 'card') {
    // Show customer info
    displayCustomerCard(parsed.cardNumber);
  }
} catch (error) {
  // Scanning cancelled or failed
  showFallbackInput();
}
```

**Scanning with Continuous Mode:**

```typescript
// Keep scanning until valid QR found
let validQR = null;

await window.Telegram.WebApp.showScanQrPopup({
  text: 'Сканируйте карту клиента'
}, (data) => {
  try {
    const parsed = parseQRData(data);

    if (parsed.type === 'card') {
      validQR = parsed;
      window.Telegram.WebApp.closeScanQrPopup();
      return true; // Stop scanning
    } else {
      // Wrong QR type, continue scanning
      window.Telegram.WebApp.showAlert('Неверный тип QR-кода');
      return false; // Continue scanning
    }
  } catch (error) {
    // Invalid QR, continue scanning
    return false;
  }
});
```

**Error Handling:**

```typescript
async function scanWithFallback() {
  // Check if scanner available (Telegram 6.2+)
  if (!window.Telegram.WebApp.isVersionAtLeast('6.2')) {
    return showManualInput();
  }

  try {
    const qrData = await scanQRCode({ text: 'Сканируйте QR-код' });
    return qrData;
  } catch (error) {
    // User cancelled or error occurred
    window.Telegram.WebApp.showConfirm(
      'Не удалось отсканировать QR-код. Ввести номер карты вручную?',
      (confirmed) => {
        if (confirmed) {
          showManualInput();
        }
      }
    );
  }
}
```

**Best Practices:**
- Always check Telegram version before using scanner
- Provide clear instructions in `text` parameter
- Validate scanned data immediately
- Provide fallback to manual input
- Add haptic feedback on successful scan
- Handle user cancellation gracefully

---

### 3. QR Data Format & Structure

Standardized data format for different QR types.

**Format Structure:**

```
loyalty:v1:{type}:{payload}:{signature}
```

**Components:**
- `loyalty` - Prefix (identifies as loyalty system QR)
- `v1` - Format version (for future compatibility)
- `{type}` - QR type (card, transaction, coupon, referral)
- `{payload}` - Base64-encoded encrypted data
- `{signature}` - HMAC-SHA256 signature

**Example QR Data:**

```
loyalty:v1:card:eyJjYXJkTnVtYmVyIjoiTEMtMTIzNDU2In0=:a3f8b2c1d4e5f6g7h8i9j0k1l2m3n4o5
```

**Payload Structure by Type:**

Refer to `references/qr_formats.md` for complete format specifications.

**Type: card (Loyalty Card)**
```json
{
  "cardNumber": "LC-123456",
  "customerId": "user-guid-123",
  "tier": "gold",
  "issuedAt": "2025-01-15T10:00:00Z"
}
```

**Type: transaction**
```json
{
  "transactionId": "tx-789",
  "amount": 1000,
  "points": 100,
  "storeId": "store-001",
  "expiresAt": "2025-01-15T10:05:00Z"
}
```

**Type: coupon**
```json
{
  "couponCode": "SAVE20",
  "discountPercent": 20,
  "minPurchase": 500,
  "oneTimeUse": true,
  "useToken": "a1b2c3d4e5f6",
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

**Type: referral**
```json
{
  "referrerId": "user-guid-456",
  "referralCode": "REF-ABC123",
  "bonusPoints": 50
}
```

**Encryption:**

Use AES-256-GCM for payload encryption before Base64 encoding.

```typescript
import crypto from 'crypto';

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

  // Combine: iv + authTag + encrypted
  const combined = Buffer.concat([iv, authTag, encrypted]);

  return combined.toString('base64');
}
```

**Best Practices:**
- Always encrypt sensitive data (customer IDs, amounts)
- Include version in format for future compatibility
- Validate format structure before parsing
- Check signature before decrypting payload
- Limit QR data size (max 2953 bytes for reliable scanning)

---

### 4. QR Validation & Parsing

Validate and parse QR codes on backend with signature verification.

**Validation Flow:**

Refer to `scripts/qr_validator.ts` for complete implementation.

```typescript
import { validateQR } from './scripts/qr_validator';

app.post('/api/qr/validate', async (req, res) => {
  const { qrData } = req.body;

  try {
    const parsed = await validateQR(qrData, {
      secretKey: process.env.QR_SECRET_KEY,
      maxAge: 300 // 5 minutes for transaction QR
    });

    // QR is valid
    res.json({ valid: true, data: parsed });
  } catch (error) {
    // QR is invalid
    res.status(400).json({ valid: false, error: error.message });
  }
});
```

**Validation Steps:**

1. **Format Validation**
   ```typescript
   const parts = qrData.split(':');
   if (parts.length !== 5) throw new Error('Invalid format');
   if (parts[0] !== 'loyalty') throw new Error('Invalid prefix');
   if (parts[1] !== 'v1') throw new Error('Unsupported version');
   ```

2. **Signature Verification**
   ```typescript
   const dataToSign = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}`;
   const expectedSig = crypto
     .createHmac('sha256', secretKey)
     .update(dataToSign)
     .digest('hex');

   if (!crypto.timingSafeEqual(Buffer.from(parts[4]), Buffer.from(expectedSig))) {
     throw new Error('Invalid signature - QR may be tampered');
   }
   ```

3. **Payload Decryption**
   ```typescript
   const decrypted = decryptPayload(parts[3], secretKey);
   const payload = JSON.parse(decrypted);
   ```

4. **Expiry Check**
   ```typescript
   if (payload.expiresAt) {
     const expiresAt = new Date(payload.expiresAt);
     if (expiresAt < new Date()) {
       throw new Error('QR code expired');
     }
   }
   ```

5. **One-Time Use Check**
   ```typescript
   if (payload.oneTimeUse && payload.useToken) {
     const used = await db.checkQRUsed(payload.useToken);
     if (used) {
       throw new Error('QR code already used');
     }
   }
   ```

**Best Practices:**
- ALWAYS validate signature before decrypting
- Use timing-safe comparison for signatures
- Check expiry immediately after decryption
- Mark one-time QR as used in database before processing
- Log all validation failures for fraud detection
- Rate limit validation endpoint

---

### 5. QR Types & Use Cases

Different QR types for different loyalty program scenarios.

#### Type 1: Loyalty Card QR

**Use Case:** Customer identification at POS, profile access

**Generation:**
```typescript
const cardQR = await generateLoyaltyQR({
  type: 'card',
  cardNumber: 'LC-123456',
  customerId: 'user-guid-123',
  tier: 'gold',
  secretKey: process.env.QR_SECRET_KEY
});
```

**Display:** Customer's profile page, Telegram bot message

**Scanning:** Cashier scans to identify customer and show balance

**Lifespan:** Permanent (no expiry)

#### Type 2: Transaction QR

**Use Case:** Cashier-initiated point accrual/redemption

**Generation:**
```typescript
const txQR = await generateLoyaltyQR({
  type: 'transaction',
  transactionId: 'tx-' + Date.now(),
  amount: 1000,
  points: 100,
  storeId: 'store-001',
  expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min
  secretKey: process.env.QR_SECRET_KEY
});
```

**Display:** Generated by cashier app after purchase total entered

**Scanning:** Customer scans to confirm transaction

**Lifespan:** 5 minutes (short expiry for security)

#### Type 3: Coupon QR

**Use Case:** Discount/promo code distribution

**Generation:**
```typescript
const couponQR = await generateLoyaltyQR({
  type: 'coupon',
  couponCode: 'SAVE20',
  discountPercent: 20,
  minPurchase: 500,
  oneTimeUse: true,
  useToken: crypto.randomBytes(16).toString('hex'),
  expiresAt: new Date('2025-12-31'),
  secretKey: process.env.QR_SECRET_KEY
});
```

**Display:** Email campaigns, in-app promotions, social media

**Scanning:** Customer scans to apply discount

**Lifespan:** Campaign duration (days/weeks)

**One-Time Use:** Yes (track by useToken)

#### Type 4: Referral QR

**Use Case:** Customer referral program

**Generation:**
```typescript
const referralQR = await generateLoyaltyQR({
  type: 'referral',
  referrerId: 'user-guid-456',
  referralCode: 'REF-ABC123',
  bonusPoints: 50,
  secretKey: process.env.QR_SECRET_KEY
});
```

**Display:** Customer's referral page in app

**Scanning:** New customer scans to get referred

**Lifespan:** Permanent

**Tracking:** Link referrals to referrer in database

---

### 6. Security & Encryption

Protect QR codes from tampering, replay attacks, and unauthorized use.

**Encryption (AES-256-GCM):**

- Algorithm: AES-256-GCM (authenticated encryption)
- Key derivation: Scrypt with salt
- IV: 16 random bytes per QR
- Auth tag: 16 bytes (prevents tampering)

**Signature (HMAC-SHA256):**

- Signs: `prefix:version:type:encryptedPayload`
- Secret: Separate from encryption key (or use same)
- Comparison: Timing-safe (prevents timing attacks)

**Key Management:**

```typescript
// Environment variables
QR_SECRET_KEY=your-64-char-hex-secret-key
QR_ENCRYPTION_KEY=your-64-char-hex-encryption-key (optional, can use same)

// Key rotation (every 90 days)
QR_SECRET_KEY_OLD=previous-key-for-validation
QR_SECRET_KEY_CURRENT=current-key-for-generation
```

**Replay Attack Prevention:**

```typescript
// For one-time use QR
const useToken = crypto.randomBytes(16).toString('hex');

// Store in database
await db.insert(qr_tokens).values({
  token: useToken,
  type: 'coupon',
  couponCode: 'SAVE20',
  used: false,
  created_at: new Date()
});

// On validation
const record = await db.query.qr_tokens.findFirst({
  where: eq(qr_tokens.token, useToken)
});

if (!record || record.used) {
  throw new Error('QR already used');
}

// Mark as used
await db.update(qr_tokens)
  .set({ used: true, used_at: new Date() })
  .where(eq(qr_tokens.token, useToken));
```

**Anti-Fraud Measures:**

1. **Rate Limiting**
   - Max 10 QR validations per minute per IP
   - Max 3 failed validations before CAPTCHA

2. **Anomaly Detection**
   - Alert if same QR scanned >5 times in 1 hour
   - Alert if QR scanned from unusual locations

3. **Audit Logging**
   - Log all QR generations
   - Log all QR validations (success/failure)
   - Track scanning patterns

Refer to `references/security_guide.md` for comprehensive security best practices.

---

### 7. Expiry & One-Time Use

Implement time-limited and one-time use QR codes.

**Expiry Implementation:**

```typescript
// Set expiry when generating
const qr = await generateLoyaltyQR({
  type: 'transaction',
  transactionId: 'tx-123',
  expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min from now
  secretKey: process.env.QR_SECRET_KEY
});

// Validate expiry on scan
const payload = decryptAndParse(qrData);

if (payload.expiresAt) {
  const expiresAt = new Date(payload.expiresAt);
  const now = new Date();

  if (now > expiresAt) {
    throw new Error(`QR expired ${Math.floor((now - expiresAt) / 1000)}s ago`);
  }
}
```

**One-Time Use Implementation:**

```typescript
// Database schema
CREATE TABLE qr_tokens (
  token VARCHAR(32) PRIMARY KEY,
  type VARCHAR(20) NOT NULL,
  coupon_code VARCHAR(50),
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_token_used (token, used)
);

// Generate with token
const useToken = crypto.randomBytes(16).toString('hex');

const qr = await generateLoyaltyQR({
  type: 'coupon',
  couponCode: 'SAVE20',
  oneTimeUse: true,
  useToken,
  secretKey: process.env.QR_SECRET_KEY
});

// Save token to database
await db.insert(qr_tokens).values({
  token: useToken,
  type: 'coupon',
  coupon_code: 'SAVE20',
  used: false
});

// Validate and mark as used (atomic operation)
const result = await db.transaction(async (tx) => {
  const record = await tx.query.qr_tokens.findFirst({
    where: and(
      eq(qr_tokens.token, useToken),
      eq(qr_tokens.used, false)
    ),
    for: 'update' // Row-level lock
  });

  if (!record) {
    throw new Error('QR already used or invalid');
  }

  await tx.update(qr_tokens)
    .set({ used: true, used_at: new Date() })
    .where(eq(qr_tokens.token, useToken));

  return record;
});
```

**Expiry Recommendations:**

- **Loyalty Card QR**: No expiry (permanent)
- **Transaction QR**: 5-10 minutes
- **Coupon QR**: Campaign duration (days to months)
- **Referral QR**: No expiry or very long (1 year)

---

### 8. Fallback to Manual Input

Provide manual input option when QR scanning fails or unavailable.

**Implementation:**

```typescript
async function getCardNumber(): Promise<string> {
  // Try QR scan first
  if (window.Telegram.WebApp.isVersionAtLeast('6.2')) {
    try {
      const qrData = await scanQRCode({
        text: 'Отсканируйте карту клиента'
      });

      const parsed = await validateQR(qrData);

      if (parsed.type === 'card') {
        return parsed.cardNumber;
      }
    } catch (error) {
      // Scan failed or cancelled
      console.log('QR scan failed, showing manual input');
    }
  }

  // Fallback to manual input
  return await showManualCardInput();
}

function showManualCardInput(): Promise<string> {
  return new Promise((resolve, reject) => {
    // Show input modal
    const modal = createModal({
      title: 'Введите номер карты',
      placeholder: 'LC-123456',
      pattern: /^LC-\d{6}$/,
      onSubmit: (value) => {
        if (/^LC-\d{6}$/.test(value)) {
          resolve(value);
        } else {
          window.Telegram.WebApp.showAlert('Неверный формат номера карты');
        }
      },
      onCancel: () => {
        reject(new Error('User cancelled'));
      }
    });

    modal.show();
  });
}
```

**Manual Input UI:**

```svelte
<script lang="ts">
  let cardNumber = $state('');
  let error = $state('');

  function handleSubmit() {
    // Validate format
    if (!/^LC-\d{6}$/.test(cardNumber)) {
      error = 'Формат: LC-123456';
      return;
    }

    // Send to backend
    validateCardNumber(cardNumber);
  }
</script>

<div class="manual-input">
  <label for="card-number">Номер карты лояльности</label>
  <input
    id="card-number"
    type="text"
    bind:value={cardNumber}
    placeholder="LC-123456"
    pattern="LC-\d{6}"
    maxlength="9"
  />
  {#if error}
    <span class="error">{error}</span>
  {/if}
  <button onclick={handleSubmit}>Продолжить</button>
</div>
```

**Best Practices:**
- Always provide fallback option
- Use clear validation messages
- Pre-fill format hints (placeholder)
- Add input masks for better UX
- Validate on both frontend and backend

---

### 9. Integration with Telegram & Backend

Complete integration flow for Telegram Mini App loyalty system.

**Frontend (Telegram Mini App):**

```typescript
// Customer shows loyalty card
async function showMyCard() {
  const user = window.Telegram.WebApp.initDataUnsafe.user;

  // Generate card QR
  const response = await fetch('/api/qr/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'card',
      userId: user.id
    })
  });

  const { qrDataURL } = await response.json();

  // Display QR in modal
  showQRModal(qrDataURL, 'Покажите QR-код кассиру');
}

// Cashier scans customer card
async function scanCustomerCard() {
  const qrData = await scanQRCode({
    text: 'Отсканируйте карту клиента'
  });

  // Validate on backend
  const response = await fetch('/api/qr/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qrData })
  });

  const { valid, data } = await response.json();

  if (valid && data.type === 'card') {
    // Show customer info
    displayCustomer(data.cardNumber);
  }
}
```

**Backend (SvelteKit API):**

```typescript
// Generate QR endpoint
export const POST: RequestHandler = async ({ request }) => {
  const { type, userId } = await request.json();

  // Get user from database
  const user = await db.query.users.findFirst({
    where: eq(users.telegram_id, userId)
  });

  if (!user) {
    return json({ error: 'User not found' }, { status: 404 });
  }

  // Generate QR
  const qrDataURL = await generateLoyaltyQR({
    type: 'card',
    cardNumber: user.card_number,
    customerId: user.id,
    tier: user.tier,
    secretKey: QR_SECRET_KEY
  });

  return json({ qrDataURL });
};

// Validate QR endpoint
export const POST: RequestHandler = async ({ request }) => {
  const { qrData } = await request.json();

  try {
    const parsed = await validateQR(qrData, {
      secretKey: QR_SECRET_KEY
    });

    return json({ valid: true, data: parsed });
  } catch (error: any) {
    return json({ valid: false, error: error.message }, { status: 400 });
  }
};
```

---

## Resources

### scripts/
- **qr_generator.ts** - QR generation with AES-256 encryption and HMAC signatures
- **qr_validator.ts** - QR validation with signature verification and expiry checks
- **qr_scanner.ts** - Telegram WebApp scanner integration with error handling

### references/
- **qr_formats.md** - Complete QR data format specifications for all types (card, transaction, coupon, referral)
- **security_guide.md** - Security best practices for QR systems (encryption, key management, anti-fraud)

---

## Quick Reference

**Generate QR:**
```typescript
const qr = await generateLoyaltyQR({
  type: 'card',
  cardNumber: 'LC-123456',
  secretKey: process.env.QR_SECRET_KEY
});
```

**Scan QR (Telegram):**
```typescript
const data = await scanQRCode({ text: 'Сканируйте QR-код' });
```

**Validate QR:**
```typescript
const parsed = await validateQR(data, { secretKey: process.env.QR_SECRET_KEY });
```

**Critical Rules:**
- ALWAYS encrypt sensitive data in QR payload
- ALWAYS validate signature before decrypting
- ALWAYS check expiry for time-limited QR codes
- ALWAYS mark one-time QR as used atomically
- PROVIDE fallback to manual input
