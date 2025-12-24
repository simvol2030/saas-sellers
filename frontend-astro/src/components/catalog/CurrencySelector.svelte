<script lang="ts">
  /**
   * Currency Selector Component
   *
   * Dropdown for selecting display currency
   */

  import { onMount } from 'svelte';

  interface Currency {
    code: string;
    symbol: string;
    name: string;
    isDefault: boolean;
  }

  let currencies: Currency[] = $state([]);
  let selectedCurrency = $state<string>('RUB');
  let loading = $state(true);

  // Load currencies
  async function loadCurrencies() {
    try {
      const res = await fetch('/api/currencies/public');
      if (res.ok) {
        currencies = await res.json();

        // Get saved currency or use default
        const saved = localStorage.getItem('selectedCurrency');
        if (saved && currencies.find((c) => c.code === saved)) {
          selectedCurrency = saved;
        } else {
          const defaultCurr = currencies.find((c) => c.isDefault);
          selectedCurrency = defaultCurr?.code || currencies[0]?.code || 'RUB';
        }

        // Dispatch initial event
        dispatchCurrencyChange();
      }
    } catch (e) {
      console.error('Failed to load currencies:', e);
    } finally {
      loading = false;
    }
  }

  // Handle currency change
  function handleChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    selectedCurrency = select.value;
    localStorage.setItem('selectedCurrency', selectedCurrency);
    dispatchCurrencyChange();
  }

  // Dispatch custom event
  function dispatchCurrencyChange() {
    const currency = currencies.find((c) => c.code === selectedCurrency);
    if (currency) {
      window.dispatchEvent(
        new CustomEvent('currencychange', {
          detail: {
            code: currency.code,
            symbol: currency.symbol,
            name: currency.name,
          },
        })
      );
    }
  }

  // Get current symbol
  function getSymbol(): string {
    return currencies.find((c) => c.code === selectedCurrency)?.symbol || '₽';
  }

  onMount(() => {
    loadCurrencies();
  });
</script>

{#if !loading && currencies.length > 1}
  <div class="currency-selector">
    <select bind:value={selectedCurrency} onchange={handleChange}>
      {#each currencies as currency (currency.code)}
        <option value={currency.code}>
          {currency.symbol} {currency.code}
        </option>
      {/each}
    </select>
  </div>
{/if}

<style>
  .currency-selector {
    position: relative;
  }

  select {
    padding: var(--spacing-2) var(--spacing-4);
    padding-right: var(--spacing-8);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    color: var(--color-text);
    font-size: var(--font-font-size-sm);
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
  }

  select:hover {
    border-color: var(--color-primary);
  }

  select:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
  }
</style>
