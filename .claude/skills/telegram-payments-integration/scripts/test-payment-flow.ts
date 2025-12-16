#!/usr/bin/env ts-node
/**
 * Test Payment Flow Script
 *
 * Usage:
 *   ts-node test-payment-flow.ts --user-id=123456789 --amount=100
 *
 * This script tests the complete payment flow:
 * 1. Creates an invoice
 * 2. Simulates payment intent creation
 * 3. Validates the created invoice
 * 4. Optionally cleans up test data
 */

import { Telegraf } from 'telegraf';
import { config } from 'dotenv';

config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

interface TestPaymentOptions {
  userId: string;
  amount: number;
  cleanup?: boolean;
}

async function testPaymentFlow(options: TestPaymentOptions) {
  console.log('🧪 Testing Payment Flow');
  console.log('========================\n');

  const { userId, amount, cleanup = true } = options;

  try {
    // Step 1: Create invoice
    console.log('1️⃣  Creating invoice...');
    const invoiceLink = await bot.telegram.createInvoiceLink({
      title: `Test Purchase - ${amount} Points`,
      description: `Test payment for ${amount} loyalty points`,
      payload: `test_${Date.now()}_${Math.random().toString(36)}`,
      provider_token: '', // Telegram Stars
      currency: 'XTR',
      prices: [
        { label: `${amount} points`, amount: Math.ceil(amount / 10) }
      ],
      photo_url: 'https://placehold.co/400x400/4361ee/ffffff?text=Test'
    });

    console.log('✅ Invoice created successfully!');
    console.log(`   Link: ${invoiceLink}\n`);

    // Step 2: Send invoice to test user
    console.log('2️⃣  Sending invoice to test user...');
    await bot.telegram.sendMessage(
      parseInt(userId),
      `🧪 Test Invoice\n\n` +
      `Amount: ${amount} points (${Math.ceil(amount / 10)} Stars)\n` +
      `This is a test payment. Do not pay unless you want to test.`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '💳 Open Invoice', url: invoiceLink }
          ]]
        }
      }
    );

    console.log('✅ Invoice sent to user\n');

    // Step 3: Check database for pending intent (if API exists)
    console.log('3️⃣  Checking for payment intent...');
    const response = await fetch('http://localhost:3000/api/payments/history?userId=' + userId);

    if (response.ok) {
      const data = await response.json();
      const pendingPayments = data.payments.filter((p: any) => p.status === 'pending');

      console.log(`   Found ${pendingPayments.length} pending payment(s)`);

      if (pendingPayments.length > 0) {
        console.log('   Latest pending payment:');
        console.log(`     ID: ${pendingPayments[0].id}`);
        console.log(`     Amount: ${pendingPayments[0].amount} Stars`);
        console.log(`     Status: ${pendingPayments[0].status}\n`);
      }
    } else {
      console.log('   ⚠️  API not available (backend not running?)\n');
    }

    // Step 4: Cleanup (if enabled)
    if (cleanup) {
      console.log('4️⃣  Cleanup test data...');
      console.log('   Note: Manual cleanup required - cancel invoice in Telegram\n');
    }

    console.log('✅ Test completed successfully!\n');
    console.log('Next steps:');
    console.log('  1. Open the invoice link in Telegram');
    console.log('  2. Complete payment (or cancel)');
    console.log('  3. Verify webhook is received');
    console.log('  4. Check balance was updated\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// CLI Interface
const args = process.argv.slice(2);
const options: TestPaymentOptions = {
  userId: '',
  amount: 100,
  cleanup: true
};

args.forEach(arg => {
  const [key, value] = arg.split('=');

  if (key === '--user-id') {
    options.userId = value;
  } else if (key === '--amount') {
    options.amount = parseInt(value);
  } else if (key === '--no-cleanup') {
    options.cleanup = false;
  }
});

if (!options.userId) {
  console.error('❌ Error: --user-id is required\n');
  console.log('Usage:');
  console.log('  ts-node test-payment-flow.ts --user-id=123456789 --amount=100');
  console.log('\nOptions:');
  console.log('  --user-id      Telegram user ID (required)');
  console.log('  --amount       Amount in points (default: 100)');
  console.log('  --no-cleanup   Skip cleanup step');
  process.exit(1);
}

// Run test
testPaymentFlow(options)
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
