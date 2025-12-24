/**
 * Payment Types - Common interfaces for all payment providers
 */

export interface PaymentConfig {
  shopId?: string;
  secretKey?: string;
  botToken?: string;
  isTest?: boolean;
  webhookSecret?: string;
}

export interface CreatePaymentRequest {
  orderId: number;
  orderNumber: string;
  amount: number;
  currency: string;
  description: string;
  returnUrl: string;
  customerEmail?: string;
  customerPhone?: string;
  metadata?: Record<string, string>;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  confirmationUrl?: string;
  status?: PaymentStatus;
  error?: string;
}

export type PaymentStatus =
  | 'pending'
  | 'waiting_for_capture'
  | 'succeeded'
  | 'canceled'
  | 'refunded';

export interface PaymentWebhookData {
  paymentId: string;
  orderId: number;
  status: PaymentStatus;
  amount: number;
  currency: string;
  paidAt?: Date;
  metadata?: Record<string, string>;
}

export interface RefundRequest {
  paymentId: string;
  amount?: number; // Partial refund, null = full
  reason?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  status?: string;
  error?: string;
}

export interface PaymentProvider {
  name: string;
  type: string;

  createPayment(request: CreatePaymentRequest): Promise<PaymentResult>;
  getPaymentStatus(paymentId: string): Promise<PaymentStatus | null>;
  refund(request: RefundRequest): Promise<RefundResult>;
  verifyWebhook(body: string, signature: string): boolean;
  parseWebhook(body: string): PaymentWebhookData | null;
}
