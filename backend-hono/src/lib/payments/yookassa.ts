/**
 * YooKassa Payment Provider
 * https://yookassa.ru/developers/api
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

interface YooKassaPayment {
  id: string;
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
  amount: { value: string; currency: string };
  confirmation?: { type: string; confirmation_url?: string };
  metadata?: Record<string, string>;
  paid: boolean;
  refundable: boolean;
  created_at: string;
}

interface YooKassaWebhookEvent {
  type: string;
  event: string;
  object: YooKassaPayment;
}

export class YooKassaProvider implements PaymentProvider {
  name = 'YooKassa';
  type = 'yookassa';

  private shopId: string;
  private secretKey: string;
  private isTest: boolean;
  private baseUrl = 'https://api.yookassa.ru/v3';

  constructor(config: PaymentConfig) {
    this.shopId = config.shopId || '';
    this.secretKey = config.secretKey || '';
    this.isTest = config.isTest ?? true;
  }

  private getAuth(): string {
    return Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64');
  }

  private generateIdempotenceKey(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  async createPayment(request: CreatePaymentRequest): Promise<PaymentResult> {
    try {
      const response = await fetch(`${this.baseUrl}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${this.getAuth()}`,
          'Idempotence-Key': this.generateIdempotenceKey(),
        },
        body: JSON.stringify({
          amount: {
            value: request.amount.toFixed(2),
            currency: request.currency,
          },
          capture: true, // Auto-capture
          confirmation: {
            type: 'redirect',
            return_url: request.returnUrl,
          },
          description: request.description,
          metadata: {
            order_id: request.orderId.toString(),
            order_number: request.orderNumber,
            ...request.metadata,
          },
          receipt: request.customerEmail ? {
            customer: {
              email: request.customerEmail,
              phone: request.customerPhone,
            },
            items: [
              {
                description: request.description.substring(0, 128),
                quantity: '1.00',
                amount: {
                  value: request.amount.toFixed(2),
                  currency: request.currency,
                },
                vat_code: 1, // НДС не облагается
                payment_mode: 'full_payment',
                payment_subject: 'commodity',
              },
            ],
          } : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { description?: string };
        console.error('YooKassa error:', errorData);
        return {
          success: false,
          error: errorData.description || 'Payment creation failed',
        };
      }

      const payment = await response.json() as YooKassaPayment;

      return {
        success: true,
        paymentId: payment.id,
        confirmationUrl: payment.confirmation?.confirmation_url,
        status: this.mapStatus(payment.status),
      };
    } catch (error) {
      console.error('YooKassa createPayment error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus | null> {
    try {
      const response = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
        headers: {
          'Authorization': `Basic ${this.getAuth()}`,
        },
      });

      if (!response.ok) return null;

      const payment = await response.json() as YooKassaPayment;
      return this.mapStatus(payment.status);
    } catch (error) {
      console.error('YooKassa getPaymentStatus error:', error);
      return null;
    }
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    try {
      // First get the payment to know the amount
      const paymentResponse = await fetch(`${this.baseUrl}/payments/${request.paymentId}`, {
        headers: {
          'Authorization': `Basic ${this.getAuth()}`,
        },
      });

      if (!paymentResponse.ok) {
        return { success: false, error: 'Payment not found' };
      }

      const payment = await paymentResponse.json() as YooKassaPayment;

      if (!payment.refundable) {
        return { success: false, error: 'Payment is not refundable' };
      }

      const refundAmount = request.amount ?? parseFloat(payment.amount.value);

      const response = await fetch(`${this.baseUrl}/refunds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${this.getAuth()}`,
          'Idempotence-Key': this.generateIdempotenceKey(),
        },
        body: JSON.stringify({
          payment_id: request.paymentId,
          amount: {
            value: refundAmount.toFixed(2),
            currency: payment.amount.currency,
          },
          description: request.reason,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { description?: string };
        return {
          success: false,
          error: errorData.description || 'Refund failed',
        };
      }

      const refund = await response.json() as { id: string; status: string };

      return {
        success: true,
        refundId: refund.id,
        status: refund.status,
      };
    } catch (error) {
      console.error('YooKassa refund error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  verifyWebhook(body: string, signature: string): boolean {
    // YooKassa uses IP whitelist, not signature
    // In production, verify request comes from YooKassa IPs:
    // 185.71.76.0/27, 185.71.77.0/27, 77.75.153.0/25, 77.75.156.11, 77.75.156.35
    // For now, we trust the webhook (should add IP check in production)
    return true;
  }

  parseWebhook(body: string): PaymentWebhookData | null {
    try {
      const event: YooKassaWebhookEvent = JSON.parse(body);

      if (!event.object) return null;

      const payment = event.object;
      const orderId = parseInt(payment.metadata?.order_id || '0');

      if (!orderId) return null;

      return {
        paymentId: payment.id,
        orderId,
        status: this.mapStatus(payment.status),
        amount: parseFloat(payment.amount.value),
        currency: payment.amount.currency,
        paidAt: payment.paid ? new Date(payment.created_at) : undefined,
        metadata: payment.metadata,
      };
    } catch (error) {
      console.error('YooKassa parseWebhook error:', error);
      return null;
    }
  }

  private mapStatus(status: string): PaymentStatus {
    switch (status) {
      case 'pending':
        return 'pending';
      case 'waiting_for_capture':
        return 'waiting_for_capture';
      case 'succeeded':
        return 'succeeded';
      case 'canceled':
        return 'canceled';
      default:
        return 'pending';
    }
  }
}
