---
name: telegram-payments-integration
description: Production-ready навык для интеграции Telegram Payments (Stars) в Mini App. Покрывает создание invoice, обработку платежей, webhook handling, верификацию, refunds, subscription payments, защиту от fraud. Используется для монетизации loyalty программы и продажи привилегий через Telegram Stars.
---

# Telegram Payments Integration

Production-ready навык для интеграции Telegram Payments (Stars) в Telegram Mini App. Покрывает весь цикл обработки платежей: от создания invoice до refund, включая security best practices и fraud prevention.

## Когда использовать

- Нужно принимать платежи в Telegram Mini App через Telegram Stars
- Монетизация loyalty программы (покупка баллов, привилегий)
- Продажа премиум-функций (расширенная аналитика, безлимитные QR)
- Subscription-модель (ежемесячная плата за доступ)
- Пополнение баланса пользователя
- Обработка refunds и dispute resolution

## Capabilities

### 1. Create and Send Invoice

Создать invoice и отправить пользователю для оплаты.

**Frontend (SvelteKit)**:
```typescript
// src/lib/services/payments.ts
import { WebApp } from '@twa-dev/sdk';

export interface InvoiceParams {
  title: string;
  description: string;
  payload: string;  // Unique payload для верификации
  providerToken: string;  // Для Stars: пустая строка
  currency: string;  // Для Stars: 'XTR'
  prices: Array<{ label: string; amount: number }>;  // amount в Stars
  photoUrl?: string;
  photoSize?: number;
  photoWidth?: number;
  photoHeight?: number;
}

export async function createInvoice(params: InvoiceParams) {
  // Генерируем уникальный payload
  const uniquePayload = `${params.payload}_${Date.now()}_${Math.random().toString(36)}`;

  // Отправляем на backend для создания invoice
  const response = await fetch('/api/payments/create-invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...params,
      payload: uniquePayload,
      userId: WebApp.initDataUnsafe.user?.id
    })
  });

  const { invoiceLink } = await response.json();

  // Открываем invoice в Telegram
  WebApp.openInvoice(invoiceLink, (status) => {
    if (status === 'paid') {
      console.log('Payment successful!');
      // Обновляем UI, показываем success
    } else if (status === 'cancelled') {
      console.log('Payment cancelled');
    } else if (status === 'failed') {
      console.error('Payment failed');
    }
  });
}

// Пример использования
export async function purchaseLoyaltyPoints(amount: number) {
  const starsAmount = Math.ceil(amount / 10);  // 1 Star = 10 баллов

  await createInvoice({
    title: `Покупка ${amount} баллов`,
    description: `Пополнить баланс loyalty программы на ${amount} баллов`,
    payload: `loyalty_points_${amount}`,
    providerToken: '',  // Для Stars - пустая строка
    currency: 'XTR',  // Telegram Stars
    prices: [
      { label: `${amount} баллов`, amount: starsAmount }
    ],
    photoUrl: 'https://example.com/loyalty-icon.png'
  });
}
```

**Backend (Express)**:
```typescript
// src/routes/payments.ts
import { Router } from 'express';
import { bot } from '../services/telegram-bot';
import { db } from '../db';
import { paymentIntents } from '../db/schema';

const router = Router();

router.post('/api/payments/create-invoice', async (req, res) => {
  const { title, description, payload, currency, prices, userId, photoUrl } = req.body;

  try {
    // Сохраняем payment intent в базу
    const [intent] = await db.insert(paymentIntents).values({
      userId,
      payload,
      title,
      description,
      currency,
      amount: prices.reduce((sum, p) => sum + p.amount, 0),
      status: 'pending',
      createdAt: new Date()
    }).returning();

    // Создаём invoice link через Bot API
    const invoiceLink = await bot.telegram.createInvoiceLink({
      title,
      description,
      payload: intent.payload,  // Используем payload из БД
      provider_token: '',  // Для Stars
      currency,
      prices,
      photo_url: photoUrl,
      need_name: false,
      need_phone_number: false,
      need_email: false,
      need_shipping_address: false,
      send_phone_number_to_provider: false,
      send_email_to_provider: false,
      is_flexible: false
    });

    logger.info({
      msg: 'Invoice created',
      intentId: intent.id,
      userId,
      amount: intent.amount
    });

    res.json({ invoiceLink, intentId: intent.id });
  } catch (error) {
    logger.error({ msg: 'Failed to create invoice', error });
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

export default router;
```

---

### 2. Handle Payment Webhooks

Обработать callback от Telegram о статусе платежа.

**Setup Bot Handlers**:
```typescript
// src/services/telegram-bot.ts
import { Telegraf } from 'telegraf';
import { db } from '../db';
import { paymentIntents, userBalances, transactions } from '../db/schema';
import { eq } from 'drizzle-orm';
import * as Sentry from '@sentry/node';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

// Pre-checkout query - валидация перед оплатой
bot.on('pre_checkout_query', async (ctx) => {
  const { id, invoice_payload, total_amount, from } = ctx.preCheckoutQuery;

  try {
    // Проверяем что payment intent существует
    const [intent] = await db
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.payload, invoice_payload))
      .limit(1);

    if (!intent) {
      logger.warn({
        msg: 'Unknown payment intent',
        payload: invoice_payload,
        userId: from.id
      });

      await ctx.answerPreCheckoutQuery(false, 'Invalid payment request');
      return;
    }

    // Проверяем что сумма совпадает
    if (intent.amount !== total_amount) {
      logger.warn({
        msg: 'Amount mismatch',
        expected: intent.amount,
        received: total_amount,
        intentId: intent.id
      });

      await ctx.answerPreCheckoutQuery(false, 'Invalid payment amount');
      return;
    }

    // Проверяем что intent ещё не оплачен (защита от replay)
    if (intent.status === 'completed') {
      logger.warn({
        msg: 'Payment intent already completed',
        intentId: intent.id
      });

      await ctx.answerPreCheckoutQuery(false, 'Payment already processed');
      return;
    }

    // Fraud detection (опционально)
    const recentPayments = await db
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.userId, from.id.toString()))
      .limit(10);

    const recentPaymentsCount = recentPayments.filter(
      p => Date.now() - p.createdAt.getTime() < 60000  // За последнюю минуту
    ).length;

    if (recentPaymentsCount > 5) {
      logger.warn({
        msg: 'Suspicious payment activity',
        userId: from.id,
        count: recentPaymentsCount
      });

      Sentry.captureMessage('Suspicious payment activity', {
        level: 'warning',
        user: { id: from.id.toString() },
        extra: { recentPaymentsCount }
      });

      await ctx.answerPreCheckoutQuery(false, 'Too many requests. Please try later.');
      return;
    }

    // Всё ОК - разрешаем оплату
    await ctx.answerPreCheckoutQuery(true);

    logger.info({
      msg: 'Pre-checkout approved',
      intentId: intent.id,
      userId: from.id,
      amount: total_amount
    });
  } catch (error) {
    logger.error({ msg: 'Pre-checkout error', error });
    Sentry.captureException(error);
    await ctx.answerPreCheckoutQuery(false, 'Internal error');
  }
});

// Successful payment - зачисление баллов
bot.on('successful_payment', async (ctx) => {
  const payment = ctx.message!.successful_payment!;
  const { invoice_payload, total_amount, telegram_payment_charge_id } = payment;
  const userId = ctx.from!.id.toString();

  try {
    // Получаем payment intent
    const [intent] = await db
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.payload, invoice_payload))
      .limit(1);

    if (!intent) {
      logger.error({
        msg: 'Payment received but intent not found',
        payload: invoice_payload,
        userId
      });

      Sentry.captureMessage('Orphan payment received', {
        level: 'error',
        extra: { payload: invoice_payload, userId, amount: total_amount }
      });
      return;
    }

    // Проверка идемпотентности
    if (intent.status === 'completed') {
      logger.warn({
        msg: 'Duplicate successful_payment webhook',
        intentId: intent.id,
        userId
      });
      return;
    }

    // Начинаем транзакцию
    await db.transaction(async (tx) => {
      // Обновляем payment intent
      await tx
        .update(paymentIntents)
        .set({
          status: 'completed',
          telegramChargeId: telegram_payment_charge_id,
          completedAt: new Date()
        })
        .where(eq(paymentIntents.id, intent.id));

      // Парсим количество баллов из payload
      const pointsMatch = intent.payload.match(/loyalty_points_(\d+)/);
      const pointsAmount = pointsMatch ? parseInt(pointsMatch[1]) : 0;

      if (pointsAmount > 0) {
        // Зачисляем баллы на баланс
        await tx
          .insert(userBalances)
          .values({
            userId,
            points: pointsAmount,
            updatedAt: new Date()
          })
          .onConflictDoUpdate({
            target: userBalances.userId,
            set: {
              points: sql`${userBalances.points} + ${pointsAmount}`,
              updatedAt: new Date()
            }
          });

        // Создаём транзакцию в истории
        await tx.insert(transactions).values({
          userId,
          type: 'purchase',
          points: pointsAmount,
          description: `Покупка ${pointsAmount} баллов через Telegram Stars`,
          metadata: {
            paymentIntentId: intent.id,
            telegramChargeId: telegram_payment_charge_id,
            starsAmount: total_amount
          },
          createdAt: new Date()
        });
      }
    });

    // Отправляем подтверждение пользователю
    await ctx.reply(
      `✅ Платёж успешно обработан!\n\n` +
      `Зачислено: ${pointsAmount} баллов\n` +
      `ID транзакции: ${intent.id}`,
      { parse_mode: 'HTML' }
    );

    logger.info({
      msg: 'Payment completed successfully',
      intentId: intent.id,
      userId,
      pointsAmount,
      starsAmount: total_amount
    });

    // Метрика для Prometheus
    paymentsTotal.labels('stars', 'completed').inc();
    paymentsRevenue.labels('stars').inc(total_amount);
  } catch (error) {
    logger.error({ msg: 'Error processing successful payment', error });
    Sentry.captureException(error, {
      extra: { payload: invoice_payload, userId, amount: total_amount }
    });

    // Пытаемся уведомить пользователя
    try {
      await ctx.reply(
        '⚠️ Платёж получен, но возникла ошибка при зачислении баллов. ' +
        'Пожалуйста, свяжитесь с поддержкой. ID: ' + invoice_payload
      );
    } catch {}
  }
});

export { bot };
```

---

### 3. Verify Payment Security

Защитить от fraud, replay attacks, amount manipulation.

**Security Middleware**:
```typescript
// src/middleware/payment-security.ts
import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { db } from '../db';
import { paymentIntents } from '../db/schema';
import { eq } from 'drizzle-orm';
import * as Sentry from '@sentry/node';

// Проверка Telegram WebApp initData
export function validateTelegramWebApp(req: Request, res: Response, next: NextFunction) {
  const initData = req.headers['x-telegram-init-data'] as string;

  if (!initData) {
    return res.status(401).json({ error: 'Missing Telegram init data' });
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    // Сортируем параметры
    const sortedParams = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Вычисляем secret key
    const secretKey = createHash('sha256')
      .update(process.env.TELEGRAM_BOT_TOKEN!)
      .digest();

    // Вычисляем hash
    const dataHash = createHash('hmac-sha256', secretKey)
      .update(sortedParams)
      .digest('hex');

    if (dataHash !== hash) {
      logger.warn({
        msg: 'Invalid Telegram init data hash',
        ip: req.ip
      });

      Sentry.captureMessage('Invalid Telegram hash', {
        level: 'warning',
        extra: { ip: req.ip }
      });

      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Проверяем auth_date (данные не старше 1 часа)
    const authDate = parseInt(params.get('auth_date') || '0');
    const now = Math.floor(Date.now() / 1000);

    if (now - authDate > 3600) {
      return res.status(401).json({ error: 'Init data expired' });
    }

    next();
  } catch (error) {
    logger.error({ msg: 'Error validating Telegram data', error });
    res.status(500).json({ error: 'Validation error' });
  }
}

// Rate limiting для создания invoices
const invoiceCreationAttempts = new Map<string, { count: number; resetAt: number }>();

export function rateLimitInvoiceCreation(req: Request, res: Response, next: NextFunction) {
  const userId = req.body.userId as string;
  const now = Date.now();

  const attempts = invoiceCreationAttempts.get(userId);

  if (attempts) {
    if (now < attempts.resetAt) {
      if (attempts.count >= 10) {  // Максимум 10 invoice за минуту
        logger.warn({
          msg: 'Invoice creation rate limit exceeded',
          userId,
          count: attempts.count
        });

        return res.status(429).json({
          error: 'Too many requests. Please try again later.'
        });
      }

      attempts.count++;
    } else {
      // Сбрасываем счётчик
      invoiceCreationAttempts.set(userId, { count: 1, resetAt: now + 60000 });
    }
  } else {
    invoiceCreationAttempts.set(userId, { count: 1, resetAt: now + 60000 });
  }

  next();
}

// Очистка старых записей rate limiting (каждые 5 минут)
setInterval(() => {
  const now = Date.now();
  for (const [userId, attempts] of invoiceCreationAttempts.entries()) {
    if (now > attempts.resetAt + 60000) {
      invoiceCreationAttempts.delete(userId);
    }
  }
}, 300000);
```

**Apply Middleware**:
```typescript
// src/routes/payments.ts
import { validateTelegramWebApp, rateLimitInvoiceCreation } from '../middleware/payment-security';

router.post(
  '/api/payments/create-invoice',
  validateTelegramWebApp,
  rateLimitInvoiceCreation,
  async (req, res) => {
    // ... (код из Capability #1)
  }
);
```

---

### 4. Process Refunds

Обработать возврат средств (refund).

**Backend Refund Handler**:
```typescript
// src/routes/payments.ts
router.post('/api/payments/refund', async (req, res) => {
  const { intentId, reason } = req.body;

  try {
    // Получаем payment intent
    const [intent] = await db
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.id, intentId))
      .limit(1);

    if (!intent) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (intent.status !== 'completed') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    if (!intent.telegramChargeId) {
      return res.status(400).json({ error: 'Missing Telegram charge ID' });
    }

    // Выполняем refund через Bot API
    const refunded = await bot.telegram.refundStarPayment(
      parseInt(intent.userId),
      intent.telegramChargeId
    );

    if (!refunded) {
      throw new Error('Refund failed');
    }

    // Обновляем базу данных
    await db.transaction(async (tx) => {
      // Обновляем payment intent
      await tx
        .update(paymentIntents)
        .set({
          status: 'refunded',
          refundReason: reason,
          refundedAt: new Date()
        })
        .where(eq(paymentIntents.id, intentId));

      // Списываем баллы с баланса
      const pointsMatch = intent.payload.match(/loyalty_points_(\d+)/);
      const pointsAmount = pointsMatch ? parseInt(pointsMatch[1]) : 0;

      if (pointsAmount > 0) {
        await tx
          .update(userBalances)
          .set({
            points: sql`${userBalances.points} - ${pointsAmount}`,
            updatedAt: new Date()
          })
          .where(eq(userBalances.userId, intent.userId));

        // Создаём транзакцию возврата
        await tx.insert(transactions).values({
          userId: intent.userId,
          type: 'refund',
          points: -pointsAmount,
          description: `Возврат: ${reason}`,
          metadata: {
            originalIntentId: intent.id,
            refundReason: reason
          },
          createdAt: new Date()
        });
      }
    });

    logger.info({
      msg: 'Refund processed successfully',
      intentId,
      userId: intent.userId,
      reason
    });

    // Уведомляем пользователя
    await bot.telegram.sendMessage(
      parseInt(intent.userId),
      `💰 Возврат обработан\n\n` +
      `Причина: ${reason}\n` +
      `Сумма: ${intent.amount} Stars\n` +
      `ID транзакции: ${intentId}`
    );

    res.json({ success: true });
  } catch (error) {
    logger.error({ msg: 'Refund error', error });
    Sentry.captureException(error);
    res.status(500).json({ error: 'Failed to process refund' });
  }
});
```

**Admin Panel UI** (для инициации refund):
```svelte
<!-- src/routes/admin/payments/[intentId]/+page.svelte -->
<script lang="ts">
  let { data } = $props();
  let refundReason = $state('');
  let processing = $state(false);

  async function processRefund() {
    if (!confirm('Вы уверены что хотите вернуть средства?')) return;

    processing = true;

    try {
      const response = await fetch('/api/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intentId: data.intent.id,
          reason: refundReason
        })
      });

      if (response.ok) {
        alert('Возврат выполнен успешно');
        window.location.reload();
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.error}`);
      }
    } catch (err) {
      alert('Ошибка сети');
    } finally {
      processing = false;
    }
  }
</script>

<div class="refund-panel">
  <h2>Возврат платежа #{data.intent.id}</h2>

  <dl>
    <dt>Пользователь:</dt>
    <dd>{data.intent.userId}</dd>

    <dt>Сумма:</dt>
    <dd>{data.intent.amount} Stars</dd>

    <dt>Статус:</dt>
    <dd>{data.intent.status}</dd>

    <dt>Дата оплаты:</dt>
    <dd>{new Date(data.intent.completedAt).toLocaleString('ru')}</dd>
  </dl>

  {#if data.intent.status === 'completed'}
    <label>
      Причина возврата:
      <input type="text" bind:value={refundReason} required />
    </label>

    <button onclick={processRefund} disabled={processing || !refundReason}>
      {processing ? 'Обработка...' : 'Выполнить возврат'}
    </button>
  {:else}
    <p>Возврат невозможен (статус: {data.intent.status})</p>
  {/if}
</div>

<style>
  .refund-panel {
    max-width: 600px;
    margin: 2rem auto;
    padding: 2rem;
    background: var(--bg-secondary);
    border-radius: 8px;
  }

  dl {
    display: grid;
    grid-template-columns: 150px 1fr;
    gap: 1rem;
    margin: 1.5rem 0;
  }

  dt {
    font-weight: 600;
  }

  label {
    display: block;
    margin: 1.5rem 0;
  }

  input {
    display: block;
    width: 100%;
    margin-top: 0.5rem;
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
  }

  button {
    padding: 0.75rem 1.5rem;
    background: var(--color-danger);
    color: white;
    border: none;
    border-radius: 4px;
    font-weight: 600;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
```

---

### 5. Track Payment History

Отслеживать историю платежей пользователя.

**Database Schema**:
```typescript
// src/db/schema.ts
import { pgTable, varchar, integer, timestamp, text, jsonb } from 'drizzle-orm/pg-core';

export const paymentIntents = pgTable('payment_intents', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar('user_id', { length: 20 }).notNull(),
  payload: text('payload').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  amount: integer('amount').notNull(),  // В Stars
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  telegramChargeId: text('telegram_charge_id'),
  refundReason: text('refund_reason'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull(),
  completedAt: timestamp('completed_at'),
  refundedAt: timestamp('refunded_at')
});

export const paymentSubscriptions = pgTable('payment_subscriptions', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar('user_id', { length: 20 }).notNull(),
  plan: varchar('plan', { length: 50 }).notNull(),  // 'premium_monthly', 'pro_yearly'
  status: varchar('status', { length: 20 }).notNull().default('active'),
  starsPerPeriod: integer('stars_per_period').notNull(),
  periodDays: integer('period_days').notNull(),  // 30 для месяца, 365 для года
  nextBillingDate: timestamp('next_billing_date').notNull(),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').notNull()
});
```

**API Endpoint**:
```typescript
// src/routes/payments.ts
router.get('/api/payments/history', async (req, res) => {
  const userId = req.query.userId as string;

  try {
    const history = await db
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.userId, userId))
      .orderBy(desc(paymentIntents.createdAt))
      .limit(50);

    res.json({ payments: history });
  } catch (error) {
    logger.error({ msg: 'Error fetching payment history', error });
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});
```

**Frontend Component**:
```svelte
<!-- src/lib/components/PaymentHistory.svelte -->
<script lang="ts">
  import type { PaymentIntent } from '$lib/types';
  import { onMount } from 'svelte';
  import { WebApp } from '@twa-dev/sdk';

  let payments = $state<PaymentIntent[]>([]);
  let loading = $state(true);

  onMount(async () => {
    const userId = WebApp.initDataUnsafe.user?.id;

    const response = await fetch(`/api/payments/history?userId=${userId}`);
    const data = await response.json();

    payments = data.payments;
    loading = false;
  });

  function formatStatus(status: string) {
    const labels = {
      pending: '⏳ Ожидает оплаты',
      completed: '✅ Оплачено',
      refunded: '💰 Возврат',
      failed: '❌ Ошибка'
    };
    return labels[status] || status;
  }
</script>

<div class="payment-history">
  <h2>История платежей</h2>

  {#if loading}
    <p>Загрузка...</p>
  {:else if payments.length === 0}
    <p class="empty">Платежей пока нет</p>
  {:else}
    <ul class="payment-list">
      {#each payments as payment}
        <li class="payment-item" data-status={payment.status}>
          <div class="payment-header">
            <strong>{payment.title}</strong>
            <span class="status">{formatStatus(payment.status)}</span>
          </div>

          <div class="payment-details">
            <span class="date">
              {new Date(payment.createdAt).toLocaleDateString('ru', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </span>
            <span class="amount">{payment.amount} Stars</span>
          </div>

          {#if payment.description}
            <p class="description">{payment.description}</p>
          {/if}

          {#if payment.refundReason}
            <p class="refund-reason">
              <strong>Причина возврата:</strong> {payment.refundReason}
            </p>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .payment-history {
    padding: 1rem;
  }

  h2 {
    margin-bottom: 1.5rem;
    font-size: 1.5rem;
  }

  .empty {
    text-align: center;
    color: var(--text-secondary);
    padding: 2rem;
  }

  .payment-list {
    list-style: none;
    padding: 0;
  }

  .payment-item {
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 0.75rem;
    border-left: 4px solid var(--border-color);
  }

  .payment-item[data-status="completed"] {
    border-left-color: var(--color-success);
  }

  .payment-item[data-status="refunded"] {
    border-left-color: var(--color-warning);
  }

  .payment-item[data-status="failed"] {
    border-left-color: var(--color-danger);
  }

  .payment-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .status {
    font-size: 0.875rem;
  }

  .payment-details {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .amount {
    font-weight: 600;
    color: var(--text-primary);
  }

  .description {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .refund-reason {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: var(--bg-warning);
    border-radius: 4px;
    font-size: 0.875rem;
  }
</style>
```

---

### 6. Implement Subscription Payments

Реализовать recurring платежи (подписки).

**Subscription Management**:
```typescript
// src/services/subscriptions.ts
import { db } from '../db';
import { paymentSubscriptions, paymentIntents } from '../db/schema';
import { eq } from 'drizzle-orm';
import { bot } from './telegram-bot';
import { logger } from './logger';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  starsPerMonth: number;
  periodDays: number;
  features: string[];
}

export const plans: Record<string, SubscriptionPlan> = {
  premium_monthly: {
    id: 'premium_monthly',
    name: 'Premium Monthly',
    description: 'Премиум доступ на месяц',
    starsPerMonth: 100,
    periodDays: 30,
    features: [
      'Безлимитные QR коды',
      'Расширенная аналитика',
      'Приоритетная поддержка',
      'Без рекламы'
    ]
  },
  pro_yearly: {
    id: 'pro_yearly',
    name: 'Pro Yearly',
    description: 'Годовая подписка Pro (2 месяца в подарок)',
    starsPerMonth: 1000,  // 10 месяцев по цене 12
    periodDays: 365,
    features: [
      'Все функции Premium',
      'Мультиаккаунт (до 5 магазинов)',
      'API доступ',
      'Белый лейбл',
      'Скидка 20%'
    ]
  }
};

export async function subscribeUser(userId: string, planId: string) {
  const plan = plans[planId];
  if (!plan) throw new Error('Unknown plan');

  // Создаём подписку в БД
  const [subscription] = await db.insert(paymentSubscriptions).values({
    userId,
    plan: planId,
    status: 'pending',
    starsPerPeriod: plan.starsPerMonth,
    periodDays: plan.periodDays,
    nextBillingDate: new Date(Date.now() + plan.periodDays * 86400000),
    createdAt: new Date()
  }).returning();

  // Создаём invoice для первого платежа
  const invoiceLink = await bot.telegram.createInvoiceLink({
    title: plan.name,
    description: plan.description,
    payload: `subscription_${subscription.id}_initial`,
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: plan.name, amount: plan.starsPerMonth }],
    photo_url: 'https://example.com/subscription-icon.png'
  });

  return { subscription, invoiceLink };
}

export async function processSubscriptionPayment(subscriptionId: string) {
  const [subscription] = await db
    .select()
    .from(paymentSubscriptions)
    .where(eq(paymentSubscriptions.id, subscriptionId))
    .limit(1);

  if (!subscription) throw new Error('Subscription not found');

  // Активируем подписку
  await db
    .update(paymentSubscriptions)
    .set({
      status: 'active',
      nextBillingDate: new Date(Date.now() + subscription.periodDays * 86400000)
    })
    .where(eq(paymentSubscriptions.id, subscriptionId));

  logger.info({
    msg: 'Subscription activated',
    subscriptionId,
    userId: subscription.userId,
    plan: subscription.plan
  });
}

export async function renewSubscriptions() {
  const now = new Date();

  // Находим подписки, которые нужно продлить
  const subscriptions = await db
    .select()
    .from(paymentSubscriptions)
    .where(
      and(
        eq(paymentSubscriptions.status, 'active'),
        lte(paymentSubscriptions.nextBillingDate, now)
      )
    );

  for (const subscription of subscriptions) {
    try {
      const plan = plans[subscription.plan];

      // Создаём invoice для продления
      const invoiceLink = await bot.telegram.createInvoiceLink({
        title: `${plan.name} - Продление`,
        description: 'Автоматическое продление подписки',
        payload: `subscription_${subscription.id}_renewal`,
        provider_token: '',
        currency: 'XTR',
        prices: [{ label: 'Продление подписки', amount: plan.starsPerMonth }]
      });

      // Отправляем пользователю
      await bot.telegram.sendMessage(
        parseInt(subscription.userId),
        `💳 Пора продлить подписку ${plan.name}!\n\n` +
        `Стоимость: ${plan.starsPerMonth} Stars\n` +
        `Следующее списание: ${new Date(subscription.nextBillingDate).toLocaleDateString('ru')}`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: 'Оплатить', url: invoiceLink }
            ]]
          }
        }
      );

      logger.info({
        msg: 'Subscription renewal invoice sent',
        subscriptionId: subscription.id,
        userId: subscription.userId
      });
    } catch (error) {
      logger.error({
        msg: 'Failed to send renewal invoice',
        subscriptionId: subscription.id,
        error
      });
    }
  }
}

// Запускаем проверку каждые 24 часа
setInterval(renewSubscriptions, 86400000);
```

---

### 7. Monitor Payment Metrics

Отслеживать метрики платежей для бизнес-аналитики.

**Prometheus Metrics**:
```typescript
// src/services/metrics.ts
import { Counter, Histogram, Gauge } from 'prom-client';
import { register } from './prometheus';

export const paymentsTotal = new Counter({
  name: 'loyalty_payments_total',
  help: 'Total number of payment attempts',
  labelNames: ['provider', 'status'],  // stars, completed|failed|refunded
  registers: [register]
});

export const paymentsRevenue = new Counter({
  name: 'loyalty_payments_revenue_stars',
  help: 'Total revenue in Telegram Stars',
  labelNames: ['provider'],
  registers: [register]
});

export const paymentProcessingDuration = new Histogram({
  name: 'loyalty_payment_processing_duration_seconds',
  help: 'Time to process payment from pre-checkout to completion',
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  labelNames: ['status'],
  registers: [register]
});

export const activeSubscriptions = new Gauge({
  name: 'loyalty_active_subscriptions',
  help: 'Number of active subscriptions',
  labelNames: ['plan'],
  registers: [register]
});

export const subscriptionChurnRate = new Gauge({
  name: 'loyalty_subscription_churn_rate',
  help: 'Subscription cancellation rate (last 30 days)',
  registers: [register]
});
```

**Usage in Payment Handlers**:
```typescript
// В bot.on('successful_payment')
const startTime = Date.now();

// ... обработка платежа ...

paymentsTotal.labels('stars', 'completed').inc();
paymentsRevenue.labels('stars').inc(total_amount);
paymentProcessingDuration
  .labels('completed')
  .observe((Date.now() - startTime) / 1000);
```

**Grafana Dashboard Query Examples**:
```promql
# Revenue per day
sum(increase(loyalty_payments_revenue_stars[1d]))

# Payment success rate
sum(rate(loyalty_payments_total{status="completed"}[5m]))
/
sum(rate(loyalty_payments_total[5m]))

# Average payment processing time
histogram_quantile(0.95, loyalty_payment_processing_duration_seconds_bucket)

# Subscription growth
rate(loyalty_active_subscriptions[1d])
```

---

## Security Best Practices

### 1. Always Validate Telegram Data

Всегда проверяй подпись `initData`:
```typescript
const isValid = validateTelegramWebApp(initData, botToken);
if (!isValid) throw new Error('Invalid Telegram data');
```

### 2. Idempotency

Используй уникальный `payload` для каждого invoice:
```typescript
const payload = `${basePayload}_${Date.now()}_${randomString()}`;
```

Проверяй статус перед повторной обработкой:
```typescript
if (intent.status === 'completed') {
  logger.warn('Duplicate webhook');
  return;
}
```

### 3. Amount Validation

Всегда проверяй сумму в `pre_checkout_query`:
```typescript
if (intent.amount !== total_amount) {
  await ctx.answerPreCheckoutQuery(false, 'Invalid amount');
  return;
}
```

### 4. Fraud Prevention

- Rate limit создание invoices (10/min per user)
- Детектируй подозрительные паттерны (много платежей за минуту)
- Лог всех платежей в Sentry для аудита
- Используй `need_name: false` (не собирай лишние данные)

### 5. Error Handling

Всегда оборачивай в try-catch:
```typescript
try {
  await processPayment();
} catch (error) {
  logger.error({ msg: 'Payment error', error });
  Sentry.captureException(error);
  await notifyAdmin(error);
}
```

### 6. PCI DSS (не применимо к Stars, но помни)

Telegram Stars обрабатывается Telegram - не храни:
- ❌ Номера карт
- ❌ CVV коды
- ❌ Платёжные токены

Храни только:
- ✅ `telegram_payment_charge_id`
- ✅ Сумму в Stars
- ✅ Статус платежа

---

## Testing

### Unit Tests

```typescript
// tests/payments.test.ts
import { describe, it, expect } from 'vitest';
import { validateTelegramWebApp } from '../src/middleware/payment-security';

describe('Payment Security', () => {
  it('should validate correct Telegram initData', () => {
    const validInitData = '...';  // Получи из реального запроса
    const isValid = validateTelegramWebApp(validInitData);
    expect(isValid).toBe(true);
  });

  it('should reject tampered initData', () => {
    const tamperedData = '...';  // Изменённые данные
    const isValid = validateTelegramWebApp(tamperedData);
    expect(isValid).toBe(false);
  });

  it('should reject expired initData', () => {
    const expiredData = '...';  // auth_date старше 1 часа
    const isValid = validateTelegramWebApp(expiredData);
    expect(isValid).toBe(false);
  });
});
```

### Integration Tests

```typescript
// tests/integration/payments.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { bot } from '../src/services/telegram-bot';
import { db } from '../src/db';

describe('Payment Flow', () => {
  let testUserId: string;
  let invoiceLink: string;

  beforeAll(async () => {
    // Setup test user
    testUserId = '123456789';
  });

  it('should create invoice', async () => {
    const response = await fetch('http://localhost:3000/api/payments/create-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Purchase',
        description: 'Test',
        payload: 'test_123',
        currency: 'XTR',
        prices: [{ label: 'Test', amount: 10 }],
        userId: testUserId
      })
    });

    const data = await response.json();
    expect(data.invoiceLink).toBeDefined();
    invoiceLink = data.invoiceLink;
  });

  it('should handle pre-checkout', async () => {
    // Симулируем pre_checkout_query от Telegram
    // (требует моков или тестовой среды Telegram)
  });

  // Остальные тесты...

  afterAll(async () => {
    // Cleanup
    await db.delete(paymentIntents).where(eq(paymentIntents.userId, testUserId));
  });
});
```

---

## Related Skills

- `telegram-miniapp-production` - Setup WebApp и initData
- `express-security-hardening` - Security middleware
- `monitoring-error-tracking` - Sentry tracking для payment errors
- `drizzle-orm-production` - Database schema для payment_intents

---

## Resources

- [Telegram Payments Bot API](https://core.telegram.org/bots/payments)
- [Telegram Stars Documentation](https://core.telegram.org/bots/payments#telegram-stars)
- [refundStarPayment API](https://core.telegram.org/bots/api#refundstarpayment)
- [Telegraf Documentation](https://telegraf.js.org/)
- [PCI DSS Compliance](https://www.pcisecuritystandards.org/)

---

## FAQ

**Q: Можно ли использовать другие провайдеры кроме Stars?**
A: Да, Telegram поддерживает Stripe, Yookassa и др. Для них `provider_token` не пустой.

**Q: Как тестировать платежи?**
A: Используй Telegram Test Environment или реальные платежи с минимальными суммами.

**Q: Что если платёж завис в pending?**
A: Telegram автоматически отменяет неоплаченные invoice через 1 час.

**Q: Можно ли вернуть средства пользователю автоматически?**
A: Да, используй `bot.telegram.refundStarPayment()` из Capability #4.

**Q: Как защититься от повторных webhook?**
A: Проверяй `intent.status` перед обработкой - если уже `completed`, игнорируй.
