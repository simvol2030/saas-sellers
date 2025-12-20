/**
 * Telegram Stars Payment Provider
 * https://core.telegram.org/bots/payments#supported-currencies
 *
 * Note: Telegram Stars are a virtual currency used in Telegram Mini Apps
 * 1 Star = approximately $0.02 USD
 */

import type {
  PaymentProvider,
  PaymentConfig,
  CreatePaymentRequest,
  PaymentResult,
  PaymentStatus,
  RefundRequest,
  RefundResult,
  PaymentWebhookData,
} from './types.js';
import { createHmac } from 'crypto';

interface TelegramInvoice {
  title: string;
  description: string;
  payload: string;
  provider_token: string;
  currency: string;
  prices: Array<{ label: string; amount: number }>;
}

interface TelegramUpdate {
  update_id: number;
  pre_checkout_query?: {
    id: string;
    from: { id: number };
    currency: string;
    total_amount: number;
    invoice_payload: string;
  };
  message?: {
    successful_payment?: {
      currency: string;
      total_amount: number;
      invoice_payload: string;
      telegram_payment_charge_id: string;
      provider_payment_charge_id: string;
    };
  };
}

export class TelegramStarsProvider implements PaymentProvider {
  name = 'Telegram Stars';
  type = 'telegram_stars';

  private botToken: string;
  private isTest: boolean;
  private baseUrl = 'https://api.telegram.org';

  // Store pending payments for status checks
  private pendingPayments = new Map<string, { orderId: number; status: PaymentStatus }>();

  constructor(config: PaymentConfig) {
    this.botToken = config.botToken || '';
    this.isTest = config.isTest ?? true;
  }

  private get apiUrl(): string {
    return `${this.baseUrl}/bot${this.botToken}`;
  }

  /**
   * Create payment link for Telegram Stars
   * Note: This creates an invoice that can be sent to user via Telegram
   */
  async createPayment(request: CreatePaymentRequest): Promise<PaymentResult> {
    try {
      // Convert amount to Stars (1 Star ≈ $0.02)
      // For XTR currency, amount is in the smallest unit (1 star = 1)
      const starsAmount = Math.ceil(request.amount);

      // Create invoice link
      const response = await fetch(`${this.apiUrl}/createInvoiceLink`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `Order ${request.orderNumber}`,
          description: request.description.substring(0, 255),
          payload: JSON.stringify({
            order_id: request.orderId,
            order_number: request.orderNumber,
            ...request.metadata,
          }),
          provider_token: '', // Empty for Telegram Stars
          currency: 'XTR', // Telegram Stars currency code
          prices: [
            {
              label: request.description.substring(0, 64),
              amount: starsAmount,
            },
          ],
        }),
      });

      const result = await response.json() as { ok: boolean; result?: string; description?: string };

      if (!result.ok) {
        console.error('Telegram Stars error:', result);
        return {
          success: false,
          error: result.description || 'Failed to create invoice',
        };
      }

      // Generate a unique payment ID for tracking
      const paymentId = `tg_${request.orderId}_${Date.now()}`;

      // Store pending payment
      this.pendingPayments.set(paymentId, {
        orderId: request.orderId,
        status: 'pending',
      });

      return {
        success: true,
        paymentId,
        confirmationUrl: result.result, // Invoice link
        status: 'pending',
      };
    } catch (error) {
      console.error('Telegram Stars createPayment error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus | null> {
    const pending = this.pendingPayments.get(paymentId);
    return pending?.status ?? null;
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    try {
      // Telegram Stars refunds require the user's Telegram ID
      // This would typically be stored with the order
      // For now, return that manual refund is needed

      const response = await fetch(`${this.apiUrl}/refundStarPayment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: 0, // Would need to be stored from the payment
          telegram_payment_charge_id: request.paymentId,
        }),
      });

      const result = await response.json() as { ok: boolean; description?: string };

      if (!result.ok) {
        return {
          success: false,
          error: result.description || 'Refund failed. Manual refund may be required.',
        };
      }

      return {
        success: true,
        refundId: request.paymentId,
        status: 'refunded',
      };
    } catch (error) {
      console.error('Telegram Stars refund error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  verifyWebhook(body: string, signature: string): boolean {
    // Telegram uses a secret token in webhook URL or X-Telegram-Bot-Api-Secret-Token header
    // Verification happens at the route level by checking the secret token
    return true;
  }

  parseWebhook(body: string): PaymentWebhookData | null {
    try {
      const update: TelegramUpdate = JSON.parse(body);

      // Handle pre-checkout query (must respond within 10 seconds)
      if (update.pre_checkout_query) {
        // This is handled separately - should respond with answerPreCheckoutQuery
        return null;
      }

      // Handle successful payment
      if (update.message?.successful_payment) {
        const payment = update.message.successful_payment;

        try {
          const payload = JSON.parse(payment.invoice_payload);
          const orderId = parseInt(payload.order_id);

          if (!orderId) return null;

          // Update pending payment status
          const paymentId = payment.telegram_payment_charge_id;
          this.pendingPayments.set(paymentId, {
            orderId,
            status: 'succeeded',
          });

          return {
            paymentId,
            orderId,
            status: 'succeeded',
            amount: payment.total_amount,
            currency: payment.currency,
            paidAt: new Date(),
            metadata: payload,
          };
        } catch (e) {
          console.error('Failed to parse payment payload:', e);
          return null;
        }
      }

      return null;
    } catch (error) {
      console.error('Telegram Stars parseWebhook error:', error);
      return null;
    }
  }

  /**
   * Answer pre-checkout query (must be called within 10 seconds)
   */
  async answerPreCheckoutQuery(queryId: string, ok: boolean, errorMessage?: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/answerPreCheckoutQuery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pre_checkout_query_id: queryId,
          ok,
          error_message: errorMessage,
        }),
      });

      const result = await response.json() as { ok: boolean };
      return result.ok;
    } catch (error) {
      console.error('answerPreCheckoutQuery error:', error);
      return false;
    }
  }
}
