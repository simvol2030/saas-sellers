<script lang="ts">
  /**
   * Checkout Page Component
   *
   * Multi-step checkout: Cart Review → Shipping → Payment
   */

  import { onMount } from 'svelte';
  import { cartStore, validateCart, fetchCart } from '../../stores/cart.svelte.js';

  interface ShippingMethod {
    id: number;
    name: string;
    description?: string | null;
    price: number;
    originalPrice: number;
    currencyCode: string;
    freeAbove?: number | null;
    minDays?: number | null;
    maxDays?: number | null;
    isFree: boolean;
  }

  interface CheckoutForm {
    email: string;
    phone: string;
    customerName: string;
    city: string;
    address: string;
    postalCode: string;
    note: string;
    promoCode: string;
  }

  interface PaymentMethod {
    id: number;
    type: string;
    name: string;
    icon: string;
    description: string;
  }

  // State
  let step = $state(1); // 1: Cart, 2: Shipping, 3: Review
  let loading = $state(false);
  let error = $state<string | null>(null);
  let orderComplete = $state(false);
  let orderNumber = $state<string | null>(null);

  // Shipping methods
  let shippingMethods = $state<ShippingMethod[]>([]);
  let selectedShippingId = $state<number | null>(null);

  // Payment methods
  let paymentMethods = $state<PaymentMethod[]>([]);
  let selectedPaymentType = $state<string>('manual');

  // Form
  let form = $state<CheckoutForm>({
    email: '',
    phone: '',
    customerName: '',
    city: '',
    address: '',
    postalCode: '',
    note: '',
    promoCode: '',
  });

  // Validation errors
  let formErrors = $state<Partial<Record<keyof CheckoutForm, string>>>({});

  // Computed
  let selectedShipping = $derived(shippingMethods.find((m) => m.id === selectedShippingId));
  let shippingCost = $derived(selectedShipping?.price ?? 0);
  let grandTotal = $derived((cartStore.total ?? 0) + shippingCost);

  // Format price
  function formatPrice(price: number): string {
    return new Intl.NumberFormat('ru-RU').format(price);
  }

  // Load shipping methods
  async function loadShippingMethods() {
    try {
      const cartTotal = cartStore.total || 0;
      const res = await fetch(`/api/shipping/methods?cartTotal=${cartTotal}`);
      if (res.ok) {
        const data = await res.json();
        shippingMethods = data.methods;
        // Select first method by default
        if (shippingMethods.length > 0 && !selectedShippingId) {
          selectedShippingId = shippingMethods[0].id;
        }
      }
    } catch (e) {
      console.error('Failed to load shipping methods:', e);
    }
  }

  // Load payment methods
  async function loadPaymentMethods() {
    try {
      const res = await fetch('/api/payments/methods');
      if (res.ok) {
        const data = await res.json();
        paymentMethods = data.methods || [];
        // Select first method or manual if none
        if (paymentMethods.length > 0) {
          selectedPaymentType = paymentMethods[0].type;
        }
      }
    } catch (e) {
      console.error('Failed to load payment methods:', e);
    }
  }

  // Validate form
  function validateForm(): boolean {
    const errors: Partial<Record<keyof CheckoutForm, string>> = {};

    if (!form.email) {
      errors.email = 'Email обязателен';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = 'Некорректный email';
    }

    if (!form.customerName) {
      errors.customerName = 'Имя обязательно';
    }

    if (!form.city) {
      errors.city = 'Город обязателен';
    }

    if (!form.address) {
      errors.address = 'Адрес обязателен';
    }

    formErrors = errors;
    return Object.keys(errors).length === 0;
  }

  // Go to next step
  async function nextStep() {
    if (step === 1) {
      // Validate cart
      loading = true;
      error = null;
      const result = await validateCart();
      loading = false;

      if (!result.valid) {
        error = result.errors?.join(', ') || 'Ошибка корзины';
        return;
      }

      await loadShippingMethods();
      step = 2;
    } else if (step === 2) {
      // Validate shipping form
      if (!validateForm()) {
        return;
      }

      if (!selectedShippingId) {
        error = 'Выберите способ доставки';
        return;
      }

      // Load payment methods
      await loadPaymentMethods();
      step = 3;
    }
  }

  // Go back
  function prevStep() {
    if (step > 1) {
      step--;
    }
  }

  // Submit order
  async function submitOrder() {
    if (!validateForm()) {
      return;
    }

    if (!selectedShippingId) {
      error = 'Выберите способ доставки';
      return;
    }

    loading = true;
    error = null;

    try {
      const res = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          phone: form.phone || undefined,
          customerName: form.customerName || undefined,
          shippingAddress: {
            city: form.city,
            address: form.address,
            postalCode: form.postalCode || undefined,
            note: form.note || undefined,
          },
          shippingMethodId: selectedShippingId,
          promoCode: form.promoCode || undefined,
          paymentMethod: selectedPaymentType,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        orderNumber = data.order.orderNumber;

        // If online payment, create payment and redirect
        if (selectedPaymentType !== 'manual' && selectedPaymentType !== 'cash') {
          await initiatePayment(data.order.id, data.order.totalAmount);
        } else {
          // Manual/cash payment - show success
          orderComplete = true;
          await fetchCart();
        }
      } else {
        const errData = await res.json();
        error = errData.error || 'Не удалось создать заказ';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Ошибка сети';
    } finally {
      loading = false;
    }
  }

  // Initiate online payment
  async function initiatePayment(orderId: number, amount: number) {
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amount,
          currency: cartStore.currencyCode || 'RUB',
          paymentType: selectedPaymentType,
          description: `Заказ ${orderNumber}`,
          returnUrl: `${window.location.origin}/orders/${orderNumber}?payment=success`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.paymentUrl) {
          // Redirect to payment page
          window.location.href = data.paymentUrl;
        } else {
          // No redirect needed (e.g., Telegram Stars handled in-app)
          orderComplete = true;
          await fetchCart();
        }
      } else {
        const errData = await res.json();
        error = errData.error || 'Не удалось создать платёж';
        // Order created but payment failed - show order number anyway
        orderComplete = true;
        await fetchCart();
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Ошибка оплаты';
      orderComplete = true;
      await fetchCart();
    }
  }

  // Initialize
  onMount(() => {
    fetchCart();
  });
</script>

<div class="checkout-page">
  {#if orderComplete}
    <!-- Success -->
    <div class="success-message">
      <div class="success-icon">✓</div>
      <h1>Заказ оформлен!</h1>
      <p>Номер заказа: <strong>{orderNumber}</strong></p>
      <p>Мы отправили подтверждение на <strong>{form.email}</strong></p>
      <div class="success-actions">
        <a href="/products" class="btn btn-primary">Продолжить покупки</a>
        <a href={`/orders/${orderNumber}`} class="btn btn-secondary">Отследить заказ</a>
      </div>
    </div>
  {:else}
    <!-- Steps indicator -->
    <div class="steps">
      <div class="step" class:active={step >= 1} class:completed={step > 1}>
        <span class="step-number">1</span>
        <span class="step-label">Корзина</span>
      </div>
      <div class="step-line" class:active={step > 1}></div>
      <div class="step" class:active={step >= 2} class:completed={step > 2}>
        <span class="step-number">2</span>
        <span class="step-label">Доставка</span>
      </div>
      <div class="step-line" class:active={step > 2}></div>
      <div class="step" class:active={step >= 3}>
        <span class="step-number">3</span>
        <span class="step-label">Подтверждение</span>
      </div>
    </div>

    {#if error}
      <div class="error-alert">
        {error}
        <button onclick={() => error = null}>×</button>
      </div>
    {/if}

    <div class="checkout-layout">
      <!-- Main content -->
      <div class="checkout-main">
        {#if step === 1}
          <!-- Step 1: Cart Review -->
          <div class="checkout-section">
            <h2>Ваша корзина</h2>

            {#if cartStore.isEmpty}
              <div class="empty-cart">
                <p>Корзина пуста</p>
                <a href="/products" class="btn btn-primary">Перейти в каталог</a>
              </div>
            {:else if cartStore.cart}
              <div class="cart-items">
                {#each cartStore.cart.items as item (item.id)}
                  <div class="cart-item">
                    <div class="item-image">
                      {#if item.product.image}
                        <img src={item.product.image} alt={item.product.name} />
                      {:else}
                        <div class="no-image">📦</div>
                      {/if}
                    </div>
                    <div class="item-details">
                      <h3>{item.product.name}</h3>
                      {#if item.variant}
                        <span class="variant">{item.variant.name}</span>
                      {/if}
                      <div class="item-price">
                        {item.quantity} × {formatPrice(item.price)} {cartStore.currencySymbol}
                      </div>
                    </div>
                    <div class="item-total">
                      {formatPrice(item.total)} {cartStore.currencySymbol}
                    </div>
                  </div>
                {/each}
              </div>

              <button class="btn btn-primary" onclick={nextStep} disabled={loading}>
                {loading ? 'Проверка...' : 'Продолжить'}
              </button>
            {/if}
          </div>
        {:else if step === 2}
          <!-- Step 2: Shipping -->
          <div class="checkout-section">
            <h2>Доставка</h2>

            <form onsubmit={(e) => { e.preventDefault(); nextStep(); }}>
              <!-- Contact -->
              <div class="form-section">
                <h3>Контактные данные</h3>

                <div class="form-group">
                  <label for="email">Email *</label>
                  <input
                    type="email"
                    id="email"
                    bind:value={form.email}
                    class:error={formErrors.email}
                    placeholder="your@email.com"
                  />
                  {#if formErrors.email}
                    <span class="field-error">{formErrors.email}</span>
                  {/if}
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label for="customerName">Имя *</label>
                    <input
                      type="text"
                      id="customerName"
                      bind:value={form.customerName}
                      class:error={formErrors.customerName}
                      placeholder="Ваше имя"
                    />
                    {#if formErrors.customerName}
                      <span class="field-error">{formErrors.customerName}</span>
                    {/if}
                  </div>

                  <div class="form-group">
                    <label for="phone">Телефон</label>
                    <input
                      type="tel"
                      id="phone"
                      bind:value={form.phone}
                      placeholder="+7 (999) 123-45-67"
                    />
                  </div>
                </div>
              </div>

              <!-- Address -->
              <div class="form-section">
                <h3>Адрес доставки</h3>

                <div class="form-row">
                  <div class="form-group">
                    <label for="city">Город *</label>
                    <input
                      type="text"
                      id="city"
                      bind:value={form.city}
                      class:error={formErrors.city}
                      placeholder="Москва"
                    />
                    {#if formErrors.city}
                      <span class="field-error">{formErrors.city}</span>
                    {/if}
                  </div>

                  <div class="form-group">
                    <label for="postalCode">Индекс</label>
                    <input
                      type="text"
                      id="postalCode"
                      bind:value={form.postalCode}
                      placeholder="123456"
                    />
                  </div>
                </div>

                <div class="form-group">
                  <label for="address">Адрес *</label>
                  <input
                    type="text"
                    id="address"
                    bind:value={form.address}
                    class:error={formErrors.address}
                    placeholder="ул. Примерная, д. 1, кв. 1"
                  />
                  {#if formErrors.address}
                    <span class="field-error">{formErrors.address}</span>
                  {/if}
                </div>

                <div class="form-group">
                  <label for="note">Комментарий</label>
                  <textarea
                    id="note"
                    bind:value={form.note}
                    placeholder="Дополнительная информация для курьера"
                    rows="3"
                  ></textarea>
                </div>
              </div>

              <!-- Shipping method -->
              <div class="form-section">
                <h3>Способ доставки</h3>

                {#if shippingMethods.length === 0}
                  <p class="muted">Загрузка способов доставки...</p>
                {:else}
                  <div class="shipping-methods">
                    {#each shippingMethods as method (method.id)}
                      <label class="shipping-option" class:selected={selectedShippingId === method.id}>
                        <input
                          type="radio"
                          name="shipping"
                          value={method.id}
                          bind:group={selectedShippingId}
                        />
                        <div class="shipping-info">
                          <span class="shipping-name">{method.name}</span>
                          {#if method.description}
                            <span class="shipping-desc">{method.description}</span>
                          {/if}
                          {#if method.minDays && method.maxDays}
                            <span class="shipping-time">{method.minDays}-{method.maxDays} дней</span>
                          {/if}
                        </div>
                        <span class="shipping-price">
                          {#if method.isFree}
                            <span class="free">Бесплатно</span>
                          {:else}
                            {formatPrice(method.price)} {cartStore.currencySymbol}
                          {/if}
                        </span>
                      </label>
                    {/each}
                  </div>
                {/if}
              </div>

              <!-- Promo code -->
              <div class="form-section">
                <h3>Промокод</h3>
                <div class="form-group">
                  <input
                    type="text"
                    bind:value={form.promoCode}
                    placeholder="Введите промокод"
                  />
                </div>
              </div>

              <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick={prevStep}>
                  Назад
                </button>
                <button type="submit" class="btn btn-primary" disabled={loading}>
                  Продолжить
                </button>
              </div>
            </form>
          </div>
        {:else if step === 3}
          <!-- Step 3: Review & Payment -->
          <div class="checkout-section">
            <h2>Подтверждение и оплата</h2>

            <div class="review-section">
              <h3>Контактные данные</h3>
              <p><strong>{form.customerName}</strong></p>
              <p>{form.email}</p>
              {#if form.phone}
                <p>{form.phone}</p>
              {/if}
            </div>

            <div class="review-section">
              <h3>Адрес доставки</h3>
              <p>{form.city}{form.postalCode ? `, ${form.postalCode}` : ''}</p>
              <p>{form.address}</p>
              {#if form.note}
                <p class="muted">{form.note}</p>
              {/if}
            </div>

            <div class="review-section">
              <h3>Способ доставки</h3>
              <p>{selectedShipping?.name}</p>
            </div>

            <div class="review-section">
              <h3>Товары</h3>
              {#if cartStore.cart}
                {#each cartStore.cart.items as item (item.id)}
                  <div class="review-item">
                    <span>{item.product.name} × {item.quantity}</span>
                    <span>{formatPrice(item.total)} {cartStore.currencySymbol}</span>
                  </div>
                {/each}
              {/if}
            </div>

            <!-- Payment method selection -->
            <div class="review-section">
              <h3>Способ оплаты</h3>
              <div class="payment-methods">
                {#each paymentMethods as method (method.id)}
                  <label class="payment-option" class:selected={selectedPaymentType === method.type}>
                    <input
                      type="radio"
                      name="payment"
                      value={method.type}
                      bind:group={selectedPaymentType}
                    />
                    <span class="payment-icon">{method.icon}</span>
                    <div class="payment-info">
                      <span class="payment-name">{method.name}</span>
                      <span class="payment-desc">{method.description}</span>
                    </div>
                  </label>
                {/each}
                <!-- Always show manual payment option -->
                <label class="payment-option" class:selected={selectedPaymentType === 'manual'}>
                  <input
                    type="radio"
                    name="payment"
                    value="manual"
                    bind:group={selectedPaymentType}
                  />
                  <span class="payment-icon">📋</span>
                  <div class="payment-info">
                    <span class="payment-name">Оплата по счёту</span>
                    <span class="payment-desc">Менеджер свяжется для оплаты</span>
                  </div>
                </label>
              </div>
            </div>

            <div class="form-actions">
              <button class="btn btn-secondary" onclick={prevStep}>
                Назад
              </button>
              <button class="btn btn-primary btn-large" onclick={submitOrder} disabled={loading}>
                {#if loading}
                  Оформление...
                {:else if selectedPaymentType !== 'manual' && selectedPaymentType !== 'cash'}
                  Перейти к оплате
                {:else}
                  Оформить заказ
                {/if}
              </button>
            </div>
          </div>
        {/if}
      </div>

      <!-- Sidebar: Order summary -->
      <aside class="checkout-sidebar">
        <div class="order-summary">
          <h3>Итого</h3>

          <div class="summary-row">
            <span>Товары ({cartStore.itemCount})</span>
            <span>{formatPrice(cartStore.total)} {cartStore.currencySymbol}</span>
          </div>

          {#if step >= 2 && selectedShipping}
            <div class="summary-row">
              <span>Доставка</span>
              <span>
                {#if selectedShipping.isFree}
                  Бесплатно
                {:else}
                  {formatPrice(shippingCost)} {cartStore.currencySymbol}
                {/if}
              </span>
            </div>
          {/if}

          <div class="summary-total">
            <span>Итого к оплате</span>
            <span class="grand-total">
              {formatPrice(step >= 2 ? grandTotal : cartStore.total)} {cartStore.currencySymbol}
            </span>
          </div>
        </div>
      </aside>
    </div>
  {/if}
</div>

<style>
  .checkout-page {
    max-width: 1200px;
    margin: 0 auto;
    padding: var(--spacing-6);
  }

  /* Steps */
  .steps {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-8);
  }

  .step {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    opacity: 0.5;
  }

  .step.active {
    opacity: 1;
  }

  .step.completed .step-number {
    background: var(--color-success);
  }

  .step-number {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-border);
    color: var(--color-text);
    border-radius: var(--radius-full);
    font-weight: var(--font-font-weight-bold);
    font-size: var(--font-font-size-sm);
  }

  .step.active .step-number {
    background: var(--color-primary);
    color: white;
  }

  .step-label {
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-medium);
  }

  .step-line {
    width: 60px;
    height: 2px;
    background: var(--color-border);
  }

  .step-line.active {
    background: var(--color-primary);
  }

  @media (max-width: 640px) {
    .step-label {
      display: none;
    }
    .step-line {
      width: 30px;
    }
  }

  /* Layout */
  .checkout-layout {
    display: grid;
    grid-template-columns: 1fr 350px;
    gap: var(--spacing-8);
  }

  @media (max-width: 900px) {
    .checkout-layout {
      grid-template-columns: 1fr;
    }

    .checkout-sidebar {
      order: -1;
    }
  }

  /* Section */
  .checkout-section {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-6);
  }

  .checkout-section h2 {
    margin: 0 0 var(--spacing-6);
    font-size: var(--font-font-size-xl);
  }

  /* Error alert */
  .error-alert {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-3) var(--spacing-4);
    background: var(--color-error-light);
    color: var(--color-error);
    border-radius: var(--radius-md);
    margin-bottom: var(--spacing-4);
  }

  .error-alert button {
    background: transparent;
    border: none;
    font-size: var(--font-font-size-lg);
    cursor: pointer;
    color: inherit;
  }

  /* Cart items */
  .cart-items {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
    margin-bottom: var(--spacing-6);
  }

  .cart-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-4);
    padding-bottom: var(--spacing-4);
    border-bottom: 1px solid var(--color-border);
  }

  .item-image {
    width: 60px;
    height: 60px;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--color-background-secondary);
    flex-shrink: 0;
  }

  .item-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .item-image .no-image {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .item-details {
    flex: 1;
  }

  .item-details h3 {
    margin: 0 0 var(--spacing-1);
    font-size: var(--font-font-size-md);
  }

  .item-details .variant {
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
  }

  .item-price {
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
  }

  .item-total {
    font-weight: var(--font-font-weight-semibold);
    white-space: nowrap;
  }

  /* Form */
  .form-section {
    margin-bottom: var(--spacing-6);
  }

  .form-section h3 {
    margin: 0 0 var(--spacing-4);
    font-size: var(--font-font-size-md);
  }

  .form-group {
    margin-bottom: var(--spacing-4);
  }

  .form-group label {
    display: block;
    margin-bottom: var(--spacing-2);
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-medium);
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: var(--spacing-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    color: var(--color-text);
    font-size: var(--font-font-size-md);
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .form-group input.error {
    border-color: var(--color-error);
  }

  .field-error {
    display: block;
    margin-top: var(--spacing-1);
    font-size: var(--font-font-size-sm);
    color: var(--color-error);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-4);
  }

  @media (max-width: 640px) {
    .form-row {
      grid-template-columns: 1fr;
    }
  }

  .form-actions {
    display: flex;
    gap: var(--spacing-4);
    justify-content: flex-end;
  }

  /* Shipping methods */
  .shipping-methods {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .shipping-option {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-4);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .shipping-option:hover {
    border-color: var(--color-primary);
  }

  .shipping-option.selected {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }

  .shipping-option input {
    accent-color: var(--color-primary);
  }

  .shipping-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .shipping-name {
    font-weight: var(--font-font-weight-medium);
  }

  .shipping-desc,
  .shipping-time {
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
  }

  .shipping-price {
    font-weight: var(--font-font-weight-semibold);
  }

  .shipping-price .free {
    color: var(--color-success);
  }

  /* Payment methods */
  .payment-methods {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .payment-option {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-4);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .payment-option:hover {
    border-color: var(--color-primary);
  }

  .payment-option.selected {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }

  .payment-option input {
    accent-color: var(--color-primary);
  }

  .payment-icon {
    font-size: 1.5rem;
  }

  .payment-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .payment-name {
    font-weight: var(--font-font-weight-medium);
  }

  .payment-desc {
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
  }

  /* Review */
  .review-section {
    margin-bottom: var(--spacing-6);
    padding-bottom: var(--spacing-4);
    border-bottom: 1px solid var(--color-border);
  }

  .review-section h3 {
    margin: 0 0 var(--spacing-2);
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .review-section p {
    margin: 0 0 var(--spacing-1);
  }

  .review-item {
    display: flex;
    justify-content: space-between;
    padding: var(--spacing-2) 0;
    font-size: var(--font-font-size-sm);
  }

  /* Sidebar */
  .order-summary {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-5);
    position: sticky;
    top: var(--spacing-4);
  }

  .order-summary h3 {
    margin: 0 0 var(--spacing-4);
    font-size: var(--font-font-size-lg);
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: var(--spacing-2) 0;
    font-size: var(--font-font-size-sm);
  }

  .summary-total {
    display: flex;
    justify-content: space-between;
    padding: var(--spacing-4) 0 0;
    margin-top: var(--spacing-4);
    border-top: 1px solid var(--color-border);
    font-size: var(--font-font-size-lg);
    font-weight: var(--font-font-weight-bold);
  }

  .grand-total {
    color: var(--color-primary);
  }

  /* Success */
  .success-message {
    text-align: center;
    padding: var(--spacing-12);
  }

  .success-icon {
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto var(--spacing-6);
    background: var(--color-success);
    color: white;
    font-size: 2.5rem;
    border-radius: var(--radius-full);
  }

  .success-message h1 {
    margin: 0 0 var(--spacing-4);
  }

  .success-message p {
    margin: 0 0 var(--spacing-2);
    color: var(--color-text-muted);
  }

  .success-actions {
    display: flex;
    gap: var(--spacing-4);
    justify-content: center;
    margin-top: var(--spacing-6);
  }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-2);
    padding: var(--spacing-3) var(--spacing-5);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-font-size-md);
    font-weight: var(--font-font-weight-medium);
    cursor: pointer;
    text-decoration: none;
    transition: all var(--transition-fast);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  .btn-secondary {
    background: var(--color-background-secondary);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--color-background);
    border-color: var(--color-text);
  }

  .btn-large {
    padding: var(--spacing-4) var(--spacing-8);
    font-size: var(--font-font-size-lg);
  }

  /* Misc */
  .muted {
    color: var(--color-text-muted);
  }

  .empty-cart {
    text-align: center;
    padding: var(--spacing-8);
  }

  .empty-cart p {
    margin-bottom: var(--spacing-4);
  }
</style>
