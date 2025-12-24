/**
 * Cart Store - Svelte 5 reactive cart state
 *
 * Uses runes for reactive state management
 */

// Types
export interface CartProduct {
  id: number;
  name: string;
  slug: string;
  sku?: string | null;
  prices: Record<string, number>;
  comparePrice?: number | null;
  image?: string | null;
  stock: number;
  stockStatus: string;
}

export interface CartVariant {
  id: number;
  name: string;
  sku?: string | null;
  prices: Record<string, number>;
  stock: number;
}

export interface CartItem {
  id: number;
  productId: number;
  variantId?: number | null;
  quantity: number;
  price: number;
  total: number;
  product: CartProduct;
  variant?: CartVariant | null;
}

export interface Cart {
  id: number;
  sessionId: string;
  currencyCode: string;
  items: CartItem[];
  subtotal: number;
  totalDiscount: number;
  itemCount: number;
  total: number;
}

// Cart state
let cart = $state<Cart | null>(null);
let loading = $state(false);
let error = $state<string | null>(null);
let isOpen = $state(false);

// Derived values
let itemCount = $derived(cart?.itemCount ?? 0);
let total = $derived(cart?.total ?? 0);
let currencyCode = $derived(cart?.currencyCode ?? 'RUB');
let isEmpty = $derived(!cart || cart.items.length === 0);

// Currency symbols map
const currencySymbols: Record<string, string> = {
  RUB: '₽',
  USD: '$',
  EUR: '€',
  CNY: '¥',
  KZT: '₸',
  PLN: 'zł',
};

let currencySymbol = $derived(currencySymbols[currencyCode] ?? currencyCode);

// API functions

/** Fetch current cart from API */
async function fetchCart(): Promise<void> {
  loading = true;
  error = null;

  try {
    const res = await fetch('/api/cart');
    if (res.ok) {
      const data = await res.json();
      cart = data.cart;
    } else {
      const errData = await res.json();
      error = errData.error || 'Failed to load cart';
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Network error';
  } finally {
    loading = false;
  }
}

/** Add item to cart */
async function addItem(
  productId: number,
  quantity: number = 1,
  variantId?: number
): Promise<boolean> {
  loading = true;
  error = null;

  try {
    const res = await fetch('/api/cart/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, variantId, quantity }),
    });

    if (res.ok) {
      const data = await res.json();
      cart = data.cart;
      // Open cart drawer on add
      isOpen = true;
      return true;
    } else {
      const errData = await res.json();
      error = errData.error || 'Failed to add item';
      return false;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Network error';
    return false;
  } finally {
    loading = false;
  }
}

/** Update item quantity */
async function updateItem(itemId: number, quantity: number): Promise<boolean> {
  loading = true;
  error = null;

  try {
    const res = await fetch(`/api/cart/items/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity }),
    });

    if (res.ok) {
      const data = await res.json();
      cart = data.cart;
      return true;
    } else {
      const errData = await res.json();
      error = errData.error || 'Failed to update item';
      return false;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Network error';
    return false;
  } finally {
    loading = false;
  }
}

/** Remove item from cart */
async function removeItem(itemId: number): Promise<boolean> {
  loading = true;
  error = null;

  try {
    const res = await fetch(`/api/cart/items/${itemId}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      const data = await res.json();
      cart = data.cart;
      return true;
    } else {
      const errData = await res.json();
      error = errData.error || 'Failed to remove item';
      return false;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Network error';
    return false;
  } finally {
    loading = false;
  }
}

/** Clear entire cart */
async function clearCart(): Promise<boolean> {
  loading = true;
  error = null;

  try {
    const res = await fetch('/api/cart', {
      method: 'DELETE',
    });

    if (res.ok) {
      const data = await res.json();
      cart = data.cart;
      return true;
    } else {
      const errData = await res.json();
      error = errData.error || 'Failed to clear cart';
      return false;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Network error';
    return false;
  } finally {
    loading = false;
  }
}

/** Change cart currency */
async function changeCurrency(newCurrencyCode: string): Promise<boolean> {
  loading = true;
  error = null;

  try {
    const res = await fetch('/api/cart/currency', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currencyCode: newCurrencyCode }),
    });

    if (res.ok) {
      const data = await res.json();
      cart = data.cart;
      return true;
    } else {
      const errData = await res.json();
      error = errData.error || 'Failed to change currency';
      return false;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Network error';
    return false;
  } finally {
    loading = false;
  }
}

/** Validate cart before checkout */
async function validateCart(): Promise<{ valid: boolean; errors?: string[]; warnings?: string[] }> {
  loading = true;
  error = null;

  try {
    const res = await fetch('/api/cart/validate', {
      method: 'POST',
    });

    const data = await res.json();

    if (res.ok) {
      cart = data.cart;
      return { valid: true, warnings: data.warnings };
    } else {
      return { valid: false, errors: data.errors, warnings: data.warnings };
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Network error';
    return { valid: false, errors: [error || 'Validation failed'] };
  } finally {
    loading = false;
  }
}

/** Toggle cart drawer */
function toggleCart(): void {
  isOpen = !isOpen;
}

/** Open cart drawer */
function openCart(): void {
  isOpen = true;
}

/** Close cart drawer */
function closeCart(): void {
  isOpen = false;
}

// Export cart store
export const cartStore = {
  // State getters (using $derived)
  get cart() { return cart; },
  get loading() { return loading; },
  get error() { return error; },
  get isOpen() { return isOpen; },
  get itemCount() { return itemCount; },
  get total() { return total; },
  get currencyCode() { return currencyCode; },
  get currencySymbol() { return currencySymbol; },
  get isEmpty() { return isEmpty; },

  // Actions
  fetchCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
  changeCurrency,
  validateCart,
  toggleCart,
  openCart,
  closeCart,
};

// Export individual functions for direct import
export {
  fetchCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
  changeCurrency,
  validateCart,
  toggleCart,
  openCart,
  closeCart,
};
