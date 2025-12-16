# Telegram Stars API Reference

Complete reference for integrating Telegram Stars payments into your Mini App.

## Overview

Telegram Stars is the native cryptocurrency of Telegram, used for in-app purchases. It's the simplest payment method for Telegram Mini Apps because:

- ✅ No external payment provider needed
- ✅ Native Telegram UX
- ✅ Low fees (commission handled by Telegram)
- ✅ Instant settlement
- ✅ Built-in fraud protection
- ✅ No KYC/verification delays

## Basic Concepts

### Currency Code

Always use `XTR` for Telegram Stars:
```typescript
currency: 'XTR'
```

### Provider Token

For Telegram Stars, provider token is always empty:
```typescript
provider_token: ''
```

### Pricing

Telegram Stars pricing is flexible - you decide the exchange rate:
```typescript
// Example: 1 Star = 10 loyalty points
const starsAmount = Math.ceil(pointsAmount / 10);

// Example: 1 Star = $0.10 USD equivalent
const starsAmount = Math.ceil(dollarAmount * 10);
```

### Minimum Amount

Minimum payment is **1 Star** (no fractional Stars).

---

## API Methods

### createInvoiceLink

Create a payment invoice link.

**Bot API Method**: `createInvoiceLink`

**Parameters**:
```typescript
{
  title: string;              // Product name (max 32 chars)
  description: string;        // Product description (max 255 chars)
  payload: string;            // Unique payload for verification (max 128 bytes)
  provider_token: string;     // Empty string for Stars
  currency: string;           // 'XTR' for Stars
  prices: Array<{             // Price breakdown
    label: string;
    amount: number;           // Amount in Stars (integer)
  }>;

  // Optional
  photo_url?: string;         // Product photo URL
  photo_size?: number;        // Photo file size
  photo_width?: number;       // Photo width
  photo_height?: number;      // Photo height

  // User data collection (set to false for Stars)
  need_name?: boolean;
  need_phone_number?: boolean;
  need_email?: boolean;
  need_shipping_address?: boolean;

  // Privacy
  send_phone_number_to_provider?: boolean;
  send_email_to_provider?: boolean;

  // Flexibility
  is_flexible?: boolean;      // false for Stars (no shipping)
}
```

**Response**:
```typescript
string  // Invoice link: https://t.me/$...
```

**Example**:
```typescript
const invoiceLink = await bot.telegram.createInvoiceLink({
  title: 'Premium Subscription',
  description: 'Unlock premium features for 30 days',
  payload: 'premium_monthly_abc123',
  provider_token: '',
  currency: 'XTR',
  prices: [
    { label: 'Premium Monthly', amount: 100 }
  ],
  photo_url: 'https://example.com/premium.png',
  need_name: false,
  need_phone_number: false,
  need_email: false,
  need_shipping_address: false,
  is_flexible: false
});
```

---

### refundStarPayment

Refund a Telegram Stars payment.

**Bot API Method**: `refundStarPayment`

**Parameters**:
```typescript
{
  user_id: number;                    // Telegram user ID
  telegram_payment_charge_id: string; // Charge ID from successful_payment
}
```

**Response**:
```typescript
boolean  // true if refund successful, false otherwise
```

**Example**:
```typescript
const refunded = await bot.telegram.refundStarPayment(
  123456789,
  'tg_charge_abc123xyz'
);

if (refunded) {
  console.log('Refund successful');
} else {
  console.error('Refund failed');
}
```

**Important Notes**:
- Can only refund within 180 days of payment
- Partial refunds not supported (full amount only)
- Refund appears instantly in user's Stars balance
- You get a webhook notification when refund is processed

---

## Webhook Updates

### pre_checkout_query

Received when user clicks "Pay" button but before payment is processed.

**Use case**: Final validation before accepting payment.

**Update structure**:
```typescript
{
  id: string;                       // Query ID
  from: User;                       // User object
  currency: string;                 // 'XTR'
  total_amount: number;             // Total in Stars
  invoice_payload: string;          // The payload you provided
}
```

**Handler example**:
```typescript
bot.on('pre_checkout_query', async (ctx) => {
  const { id, invoice_payload, total_amount, from } = ctx.preCheckoutQuery;

  // Validate payment intent
  const intent = await db.getPaymentIntent(invoice_payload);

  if (!intent || intent.amount !== total_amount) {
    // Reject payment
    await ctx.answerPreCheckoutQuery(false, 'Invalid payment request');
    return;
  }

  // Accept payment
  await ctx.answerPreCheckoutQuery(true);
});
```

**Response method**: `answerPreCheckoutQuery`

**Parameters**:
```typescript
{
  ok: boolean;           // true to accept, false to reject
  error_message?: string; // Error message if ok=false (max 255 chars)
}
```

**Important**:
- Must respond within **10 seconds**
- If you don't respond, payment is auto-rejected
- If ok=true, payment will be processed immediately
- If ok=false, user sees error_message

---

### successful_payment

Received when payment is successfully completed.

**Use case**: Credit user account, send receipt, update database.

**Update structure**:
```typescript
{
  message: {
    from: User;
    successful_payment: {
      currency: string;                    // 'XTR'
      total_amount: number;                // Total in Stars
      invoice_payload: string;             // Your payload
      telegram_payment_charge_id: string;  // Save for refunds!
      provider_payment_charge_id: string;  // Provider charge ID (empty for Stars)
    }
  }
}
```

**Handler example**:
```typescript
bot.on('successful_payment', async (ctx) => {
  const payment = ctx.message!.successful_payment!;
  const { invoice_payload, total_amount, telegram_payment_charge_id } = payment;

  // Update database
  await db.transaction(async (tx) => {
    await tx.updatePaymentIntent(invoice_payload, {
      status: 'completed',
      chargeId: telegram_payment_charge_id
    });

    await tx.creditUserBalance(ctx.from!.id, parseAmount(invoice_payload));
  });

  // Send receipt
  await ctx.reply(
    `✅ Payment successful!\n\n` +
    `Amount: ${total_amount} Stars\n` +
    `Transaction ID: ${telegram_payment_charge_id}`
  );
});
```

**Important**:
- This update is **idempotent-safe** (may receive duplicates)
- Always save `telegram_payment_charge_id` for refunds
- Process atomically (use database transactions)
- Send confirmation to user

---

## Frontend Integration

### Open Invoice from WebApp

Use Telegram WebApp SDK to open invoice:

```typescript
import { WebApp } from '@twa-dev/sdk';

// Open invoice
WebApp.openInvoice(invoiceLink, (status) => {
  switch (status) {
    case 'paid':
      console.log('Payment successful!');
      // Update UI, show success message
      break;

    case 'cancelled':
      console.log('Payment cancelled by user');
      break;

    case 'failed':
      console.error('Payment failed');
      // Show error message
      break;

    case 'pending':
      console.log('Payment is pending');
      // Show loading state
      break;
  }
});
```

**Status values**:
- `paid` - Payment completed successfully
- `cancelled` - User cancelled payment
- `failed` - Payment failed (insufficient funds, etc.)
- `pending` - Payment is being processed

---

## Security Best Practices

### 1. Unique Payloads

Always generate unique payloads to prevent replay attacks:

```typescript
const payload = `${basePayload}_${Date.now()}_${crypto.randomUUID()}`;
```

### 2. Amount Validation

Validate amount in `pre_checkout_query`:

```typescript
if (intent.amount !== total_amount) {
  await ctx.answerPreCheckoutQuery(false, 'Invalid amount');
  return;
}
```

### 3. Idempotency

Check status before processing `successful_payment`:

```typescript
if (intent.status === 'completed') {
  logger.warn('Duplicate webhook');
  return; // Already processed
}
```

### 4. Rate Limiting

Limit invoice creation to prevent abuse:

```typescript
// Max 10 invoices per minute per user
if (userInvoiceCount > 10) {
  throw new Error('Rate limit exceeded');
}
```

### 5. Fraud Detection

Monitor suspicious patterns:

```typescript
// Flag users with >5 payments in 1 minute
const recentPayments = await getRecentPayments(userId, 60000);

if (recentPayments.length > 5) {
  await notifyAdmin('Suspicious payment activity', { userId });
}
```

---

## Error Handling

### Common Errors

**Invoice Creation Failed**:
```typescript
try {
  const link = await bot.telegram.createInvoiceLink(...);
} catch (error) {
  if (error.code === 400) {
    // Invalid parameters
  } else if (error.code === 429) {
    // Rate limit exceeded
  }
}
```

**Pre-checkout Timeout**:
```typescript
// Auto-reject if validation takes >10 seconds
const timeout = setTimeout(() => {
  ctx.answerPreCheckoutQuery(false, 'Request timeout');
}, 9000);

// Perform validation
await validatePayment();
clearTimeout(timeout);

ctx.answerPreCheckoutQuery(true);
```

**Refund Failed**:
```typescript
const refunded = await bot.telegram.refundStarPayment(userId, chargeId);

if (!refunded) {
  // Possible reasons:
  // - Payment older than 180 days
  // - Already refunded
  // - Invalid charge ID
  logger.error('Refund failed', { userId, chargeId });
}
```

---

## Testing

### Test Environment

Telegram doesn't have a sandbox for Stars. Options:

1. **Use real Stars with small amounts**:
   - Create test invoices for 1-5 Stars
   - Complete actual payments
   - Refund after testing

2. **Use test users**:
   - Create Telegram test accounts
   - Transfer small amounts of Stars
   - Test full flow

3. **Mock webhooks locally**:
   - Simulate `pre_checkout_query` and `successful_payment`
   - Test validation logic without real payments

### Test Checklist

- [ ] Create invoice successfully
- [ ] Invoice opens in Telegram
- [ ] Pre-checkout validation works
- [ ] Payment completes successfully
- [ ] User balance updated correctly
- [ ] Receipt sent to user
- [ ] Duplicate webhooks handled
- [ ] Refund works correctly
- [ ] Refund updates balance
- [ ] Rate limiting prevents abuse

---

## Pricing Strategy

### Exchange Rates

Common strategies:

**1. Fixed Rate**:
```typescript
const STARS_PER_POINT = 0.1; // 10 points = 1 Star
const starsAmount = pointsAmount * STARS_PER_POINT;
```

**2. Tiered Pricing**:
```typescript
const tiers = [
  { points: 100, stars: 5 },    // 100 points = 5 Stars
  { points: 500, stars: 20 },   // 500 points = 20 Stars (20% bonus)
  { points: 1000, stars: 35 },  // 1000 points = 35 Stars (30% bonus)
];
```

**3. Dynamic Pricing**:
```typescript
// Price based on user tier, location, etc.
const basePrice = 100;
const discount = user.isPremium ? 0.2 : 0;
const stars = Math.ceil(basePrice * (1 - discount));
```

### Subscription Pricing

**Monthly**:
```typescript
{
  plan: 'premium_monthly',
  stars: 100,
  period: 30
}
```

**Yearly** (offer discount):
```typescript
{
  plan: 'premium_yearly',
  stars: 1000,  // 2 months free (100 * 10 instead of 12)
  period: 365
}
```

---

## Limitations

### Amount Limits

- **Minimum**: 1 Star
- **Maximum**: No documented limit (but Telegram may have internal limits)
- **Precision**: Integer only (no fractional Stars)

### Payload Limits

- **Max length**: 128 bytes (UTF-8 encoded)
- **Allowed chars**: Any UTF-8 characters
- **Recommendation**: Use base64 or hex encoding

### Refund Limits

- **Time window**: 180 days from payment
- **Partial refunds**: Not supported (full amount only)
- **Frequency**: No documented limit

### Rate Limits

- **Invoice creation**: Not documented (likely ~100/min)
- **Refunds**: Not documented
- **Recommendation**: Implement your own rate limiting

---

## Resources

- [Telegram Payments Bot API](https://core.telegram.org/bots/payments)
- [Telegram Stars Documentation](https://core.telegram.org/bots/payments#telegram-stars)
- [Bot API Reference](https://core.telegram.org/bots/api)
- [WebApp SDK](https://core.telegram.org/bots/webapps)
- [Telegraf Library](https://telegraf.js.org/)

---

## FAQ

**Q: What's the fee for Telegram Stars?**
A: Telegram charges a commission (exact % not publicly disclosed). The fee is deducted from your payout, not charged to users.

**Q: How do I withdraw Stars earnings?**
A: Use the Bot Payments section in @BotFather. Convert Stars to fiat via Telegram's payment partners.

**Q: Can I accept other payment methods?**
A: Yes! Telegram supports Stripe, Yookassa, and others. Set `provider_token` to your provider's token.

**Q: What if user disputes payment?**
A: Telegram handles disputes. You may be asked to provide transaction details. Always log all payments for audit trail.

**Q: Can I test without real payments?**
A: No official test mode. Use small amounts (1-5 Stars) for testing, then refund.

**Q: How long until I receive payment?**
A: Stars are credited to your bot balance immediately after payment. Payout schedule depends on your agreement with Telegram.
