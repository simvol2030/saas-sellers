/**
 * Payment Provider Factory
 */

import type { PaymentProvider, PaymentConfig } from './types.js';
import { YooKassaProvider } from './yookassa.js';
import { TelegramStarsProvider } from './telegram-stars.js';

export * from './types.js';
export { YooKassaProvider } from './yookassa.js';
export { TelegramStarsProvider } from './telegram-stars.js';

export type PaymentProviderType = 'yookassa' | 'telegram_stars' | 'cash';

export function createPaymentProvider(
  type: PaymentProviderType,
  config: PaymentConfig
): PaymentProvider | null {
  switch (type) {
    case 'yookassa':
      return new YooKassaProvider(config);
    case 'telegram_stars':
      return new TelegramStarsProvider(config);
    case 'cash':
      // Cash on delivery doesn't need a provider
      return null;
    default:
      return null;
  }
}

/**
 * Get available payment methods for display
 */
export function getPaymentMethodInfo(type: string): { name: string; icon: string; description: string } {
  switch (type) {
    case 'yookassa':
      return {
        name: 'Банковская карта',
        icon: 'credit-card',
        description: 'Visa, MasterCard, МИР',
      };
    case 'telegram_stars':
      return {
        name: 'Telegram Stars',
        icon: 'star',
        description: 'Оплата звездами Telegram',
      };
    case 'cash':
      return {
        name: 'Наличные',
        icon: 'cash',
        description: 'Оплата при получении',
      };
    default:
      return {
        name: type,
        icon: 'payment',
        description: '',
      };
  }
}
