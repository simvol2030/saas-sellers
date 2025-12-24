/**
 * Email HTML Templates
 *
 * Responsive email templates for transactional emails
 */

// Common styles
const baseStyles = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; }
  .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #3b82f6; }
  .header h1 { margin: 0; color: #3b82f6; font-size: 24px; }
  .content { padding: 30px 20px; }
  .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #eee; }
  .button { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 500; }
  .order-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  .order-table th, .order-table td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
  .order-table th { background-color: #f9fafb; font-weight: 600; }
  .total-row { font-weight: 700; background-color: #f0f9ff; }
  .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
  .badge-success { background-color: #dcfce7; color: #166534; }
  .badge-warning { background-color: #fef3c7; color: #92400e; }
  .badge-error { background-color: #fee2e2; color: #b91c1c; }
  .info-box { background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 15px; margin: 20px 0; }
  .alert-box { background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; padding: 15px; margin: 20px 0; }
`;

function wrapTemplate(content: string, siteName: string = 'Магазин'): string {
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${siteName}</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>Это автоматическое сообщение. Пожалуйста, не отвечайте на него.</p>
      <p>&copy; ${new Date().getFullYear()} ${siteName}</p>
    </div>
  </div>
</body>
</html>
`;
}

interface OrderItem {
  product: { name: string } | null;
  name: string;
  quantity: number;
  price: number | string | { toNumber?: () => number };
  total: number | string | { toNumber?: () => number };
}

interface Order {
  orderNumber: string;
  customerName?: string | null;
  email: string;
  phone?: string | null;
  shippingAddress: string;
  currencyCode: string;
  subtotal: number | string | { toNumber?: () => number };
  discount: number | string | { toNumber?: () => number };
  shippingCost: number | string | { toNumber?: () => number };
  total: number | string | { toNumber?: () => number };
  paymentMethod?: string | null;
  status: string;
  items: OrderItem[];
  site?: { name: string } | null;
}

function toNumber(value: number | string | { toNumber?: () => number } | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  if (typeof value.toNumber === 'function') return value.toNumber();
  return 0;
}

/**
 * Order confirmation email template
 */
export function getOrderEmailTemplate(order: Order): string {
  const siteName = order.site?.name || 'Магазин';
  let shippingInfo: { city?: string; address?: string } = {};
  try {
    shippingInfo = JSON.parse(order.shippingAddress);
  } catch {
    shippingInfo = { address: order.shippingAddress };
  }

  const itemsHtml = order.items
    .map(
      (item) => `
      <tr>
        <td>${item.product?.name || item.name}</td>
        <td style="text-align: center;">${item.quantity}</td>
        <td style="text-align: right;">${toNumber(item.price).toFixed(2)} ${order.currencyCode}</td>
        <td style="text-align: right;">${toNumber(item.total).toFixed(2)} ${order.currencyCode}</td>
      </tr>
    `
    )
    .join('');

  const content = `
    <h2>Спасибо за заказ!</h2>
    <p>Здравствуйте${order.customerName ? `, ${order.customerName}` : ''}!</p>
    <p>Ваш заказ <strong>${order.orderNumber}</strong> успешно оформлен и принят в обработку.</p>

    <div class="info-box">
      <strong>Статус:</strong> <span class="badge badge-success">Получен</span>
    </div>

    <h3>Детали заказа</h3>
    <table class="order-table">
      <thead>
        <tr>
          <th>Товар</th>
          <th style="text-align: center;">Кол-во</th>
          <th style="text-align: right;">Цена</th>
          <th style="text-align: right;">Сумма</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="text-align: right;">Подытог:</td>
          <td style="text-align: right;">${toNumber(order.subtotal).toFixed(2)} ${order.currencyCode}</td>
        </tr>
        ${
          toNumber(order.discount) > 0
            ? `<tr>
          <td colspan="3" style="text-align: right;">Скидка:</td>
          <td style="text-align: right; color: #16a34a;">-${toNumber(order.discount).toFixed(2)} ${order.currencyCode}</td>
        </tr>`
            : ''
        }
        ${
          toNumber(order.shippingCost) > 0
            ? `<tr>
          <td colspan="3" style="text-align: right;">Доставка:</td>
          <td style="text-align: right;">${toNumber(order.shippingCost).toFixed(2)} ${order.currencyCode}</td>
        </tr>`
            : ''
        }
        <tr class="total-row">
          <td colspan="3" style="text-align: right;">Итого:</td>
          <td style="text-align: right;">${toNumber(order.total).toFixed(2)} ${order.currencyCode}</td>
        </tr>
      </tfoot>
    </table>

    <h3>Доставка</h3>
    <p>
      ${shippingInfo.city ? `${shippingInfo.city}<br>` : ''}
      ${shippingInfo.address || order.shippingAddress}
    </p>

    ${order.phone ? `<p><strong>Телефон:</strong> ${order.phone}</p>` : ''}
    ${order.paymentMethod ? `<p><strong>Способ оплаты:</strong> ${order.paymentMethod}</p>` : ''}

    <p style="margin-top: 30px;">Мы свяжемся с вами для подтверждения заказа.</p>
  `;

  return wrapTemplate(content, siteName);
}

interface PaymentOrder {
  orderNumber: string;
  customerName?: string | null;
  total: number | string | { toNumber?: () => number };
  currencyCode: string;
  paymentMethod?: string | null;
  site?: { name: string } | null;
}

/**
 * Payment received email template
 */
export function getPaymentEmailTemplate(order: PaymentOrder): string {
  const siteName = order.site?.name || 'Магазин';

  const content = `
    <h2>Оплата получена!</h2>
    <p>Здравствуйте${order.customerName ? `, ${order.customerName}` : ''}!</p>

    <div class="info-box">
      <p style="margin: 0;">Мы получили оплату по вашему заказу <strong>${order.orderNumber}</strong>.</p>
    </div>

    <p><strong>Сумма:</strong> ${toNumber(order.total).toFixed(2)} ${order.currencyCode}</p>
    ${order.paymentMethod ? `<p><strong>Способ оплаты:</strong> ${order.paymentMethod}</p>` : ''}

    <p>Ваш заказ передан в обработку. Мы уведомим вас об отправке.</p>

    <p style="margin-top: 30px;">Спасибо за покупку!</p>
  `;

  return wrapTemplate(content, siteName);
}

interface LowStockProduct {
  name: string;
  sku?: string | null;
  stock: number;
  lowStockThreshold: number;
}

/**
 * Low stock alert email template
 */
export function getLowStockEmailTemplate(products: LowStockProduct[]): string {
  const outOfStock = products.filter((p) => p.stock === 0);
  const lowStock = products.filter((p) => p.stock > 0);

  const formatProduct = (p: LowStockProduct) => `
    <tr>
      <td>${p.name}</td>
      <td>${p.sku || '—'}</td>
      <td style="text-align: center; ${p.stock === 0 ? 'color: #b91c1c; font-weight: 700;' : ''}">${p.stock}</td>
      <td style="text-align: center;">${p.lowStockThreshold}</td>
    </tr>
  `;

  const content = `
    <h2>Низкий остаток товаров</h2>

    <div class="alert-box">
      <p style="margin: 0;">Обнаружено ${products.length} товаров с низким остатком${outOfStock.length > 0 ? `, из них ${outOfStock.length} закончились` : ''}.</p>
    </div>

    ${
      outOfStock.length > 0
        ? `
      <h3 style="color: #b91c1c;">Закончились (${outOfStock.length})</h3>
      <table class="order-table">
        <thead>
          <tr>
            <th>Товар</th>
            <th>Артикул</th>
            <th style="text-align: center;">Остаток</th>
            <th style="text-align: center;">Порог</th>
          </tr>
        </thead>
        <tbody>
          ${outOfStock.map(formatProduct).join('')}
        </tbody>
      </table>
    `
        : ''
    }

    ${
      lowStock.length > 0
        ? `
      <h3 style="color: #92400e;">Низкий остаток (${lowStock.length})</h3>
      <table class="order-table">
        <thead>
          <tr>
            <th>Товар</th>
            <th>Артикул</th>
            <th style="text-align: center;">Остаток</th>
            <th style="text-align: center;">Порог</th>
          </tr>
        </thead>
        <tbody>
          ${lowStock.map(formatProduct).join('')}
        </tbody>
      </table>
    `
        : ''
    }

    <p>Рекомендуем пополнить запасы товаров.</p>
  `;

  return wrapTemplate(content, 'Уведомление о запасах');
}

/**
 * Order status update email template
 */
export function getOrderStatusEmailTemplate(
  order: { orderNumber: string; customerName?: string | null; site?: { name: string } | null },
  newStatus: string,
  note?: string
): string {
  const siteName = order.site?.name || 'Магазин';

  const statusLabels: Record<string, { label: string; badge: string }> = {
    pending: { label: 'Ожидает подтверждения', badge: 'badge-warning' },
    confirmed: { label: 'Подтверждён', badge: 'badge-success' },
    processing: { label: 'В обработке', badge: 'badge-success' },
    shipped: { label: 'Отправлен', badge: 'badge-success' },
    delivered: { label: 'Доставлен', badge: 'badge-success' },
    cancelled: { label: 'Отменён', badge: 'badge-error' },
    refunded: { label: 'Возвращён', badge: 'badge-warning' },
  };

  const status = statusLabels[newStatus] || { label: newStatus, badge: '' };

  const content = `
    <h2>Статус заказа обновлён</h2>
    <p>Здравствуйте${order.customerName ? `, ${order.customerName}` : ''}!</p>

    <p>Статус вашего заказа <strong>${order.orderNumber}</strong> изменён:</p>

    <div class="info-box" style="text-align: center;">
      <span class="badge ${status.badge}" style="font-size: 16px; padding: 8px 16px;">
        ${status.label}
      </span>
    </div>

    ${note ? `<p><strong>Комментарий:</strong> ${note}</p>` : ''}

    <p>Если у вас есть вопросы, свяжитесь с нами.</p>
  `;

  return wrapTemplate(content, siteName);
}
