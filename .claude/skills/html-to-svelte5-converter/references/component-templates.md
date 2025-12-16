# Component Templates

Ready-to-use Svelte 5 component templates for common UI patterns.

## Navigation Components

### Simple Navigation Bar

```svelte
<script lang="ts">
  interface NavItem {
    label: string;
    href: string;
    active?: boolean;
  }

  interface Props {
    items: NavItem[];
    logoUrl?: string;
    logoText?: string;
  }

  let { items, logoUrl, logoText = 'Logo' }: Props = $props();
  let mobileMenuOpen = $state(false);
</script>

<nav class="navbar">
  <div class="navbar-brand">
    {#if logoUrl}
      <img src={logoUrl} alt={logoText} />
    {:else}
      <span>{logoText}</span>
    {/if}
  </div>

  <button
    class="mobile-toggle"
    onclick={() => mobileMenuOpen = !mobileMenuOpen}
    aria-label="Toggle menu"
  >
    ☰
  </button>

  <ul class={{ 'navbar-menu': true, open: mobileMenuOpen }}>
    {#each items as item}
      <li>
        <a
          href={item.href}
          class={{ active: item.active }}
        >
          {item.label}
        </a>
      </li>
    {/each}
  </ul>
</nav>

<style>
  .navbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 2rem;
    background: #fff;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .navbar-brand {
    font-size: 1.5rem;
    font-weight: bold;
  }

  .mobile-toggle {
    display: none;
  }

  .navbar-menu {
    display: flex;
    gap: 2rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .navbar-menu a {
    text-decoration: none;
    color: #333;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .navbar-menu a:hover,
  .navbar-menu a.active {
    background: #f0f0f0;
  }

  @media (max-width: 768px) {
    .mobile-toggle {
      display: block;
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
    }

    .navbar-menu {
      display: none;
      flex-direction: column;
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: #fff;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      padding: 1rem;
    }

    .navbar-menu.open {
      display: flex;
    }
  }
</style>
```

---

## Form Components

### Login Form

```svelte
<script lang="ts">
  interface Props {
    onSubmit?: (credentials: { email: string; password: string }) => void | Promise<void>;
  }

  let { onSubmit }: Props = $props();

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  let isValid = $derived(
    email.includes('@') && password.length >= 8
  );

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    error = '';

    if (!isValid) {
      error = 'Please provide valid email and password (min 8 characters)';
      return;
    }

    loading = true;

    try {
      await onSubmit?.({ email, password });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Login failed';
    } finally {
      loading = false;
    }
  }
</script>

<form class="login-form" onsubmit={handleSubmit}>
  <h2>Login</h2>

  {#if error}
    <div class="error">{error}</div>
  {/if}

  <div class="form-group">
    <label for="email">Email</label>
    <input
      id="email"
      type="email"
      bind:value={email}
      required
      disabled={loading}
    />
  </div>

  <div class="form-group">
    <label for="password">Password</label>
    <input
      id="password"
      type="password"
      bind:value={password}
      required
      minlength="8"
      disabled={loading}
    />
  </div>

  <button
    type="submit"
    disabled={!isValid || loading}
  >
    {loading ? 'Logging in...' : 'Login'}
  </button>
</form>

<style>
  .login-form {
    max-width: 400px;
    margin: 2rem auto;
    padding: 2rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: #fff;
  }

  h2 {
    margin-top: 0;
    text-align: center;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
  }

  input:focus {
    outline: none;
    border-color: #007bff;
  }

  input:disabled {
    background: #f5f5f5;
    cursor: not-allowed;
  }

  button {
    width: 100%;
    padding: 0.75rem;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  button:hover:not(:disabled) {
    background: #0056b3;
  }

  button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .error {
    padding: 0.75rem;
    margin-bottom: 1rem;
    background: #fee;
    color: #c33;
    border-radius: 4px;
    font-size: 0.875rem;
  }
</style>
```

---

## Card Components

### Product Card

```svelte
<script lang="ts">
  interface Props {
    title: string;
    description: string;
    price: number;
    imageUrl?: string;
    onAddToCart?: () => void;
  }

  let {
    title,
    description,
    price,
    imageUrl,
    onAddToCart
  }: Props = $props();

  let formattedPrice = $derived(`$${price.toFixed(2)}`);
</script>

<article class="product-card">
  {#if imageUrl}
    <img src={imageUrl} alt={title} />
  {/if}

  <div class="content">
    <h3>{title}</h3>
    <p class="description">{description}</p>

    <div class="footer">
      <span class="price">{formattedPrice}</span>
      {#if onAddToCart}
        <button onclick={onAddToCart}>
          Add to Cart
        </button>
      {/if}
    </div>
  </div>
</article>

<style>
  .product-card {
    border: 1px solid #ddd;
    border-radius: 8px;
    overflow: hidden;
    transition: box-shadow 0.2s;
  }

  .product-card:hover {
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  }

  img {
    width: 100%;
    height: 200px;
    object-fit: cover;
  }

  .content {
    padding: 1rem;
  }

  h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
  }

  .description {
    color: #666;
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .price {
    font-size: 1.5rem;
    font-weight: bold;
    color: #007bff;
  }

  button {
    padding: 0.5rem 1rem;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
  }

  button:hover {
    background: #0056b3;
  }
</style>
```

---

## Modal Components

### Modal Dialog

```svelte
<script lang="ts">
  interface Props {
    title?: string;
    open?: boolean;
    onClose?: () => void;
    children?: any;
  }

  let { title, open = false, onClose, children }: Props = $props();

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose?.();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose?.();
    }
  }
</script>

{#if open}
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
  >
    <div class="modal-content">
      <div class="modal-header">
        {#if title}
          <h2>{title}</h2>
        {/if}
        <button
          class="close-btn"
          onclick={onClose}
          aria-label="Close modal"
        >
          ×
        </button>
      </div>

      <div class="modal-body">
        {@render children?.()}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: white;
    border-radius: 8px;
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #ddd;
  }

  h2 {
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    color: #999;
    line-height: 1;
    padding: 0;
  }

  .close-btn:hover {
    color: #333;
  }

  .modal-body {
    padding: 1.5rem;
  }
</style>
```

---

## List Components

### Sortable Data Table

```svelte
<script lang="ts">
  interface Column<T> {
    key: keyof T;
    label: string;
    sortable?: boolean;
  }

  interface Props<T> {
    data: T[];
    columns: Column<T>[];
  }

  let { data, columns }: Props<any> = $props();

  let sortKey = $state<string | null>(null);
  let sortDirection = $state<'asc' | 'desc'>('asc');

  let sortedData = $derived.by(() => {
    if (!sortKey) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  });

  function handleSort(key: string) {
    if (sortKey === key) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDirection = 'asc';
    }
  }
</script>

<table class="data-table">
  <thead>
    <tr>
      {#each columns as column}
        <th>
          {#if column.sortable}
            <button
              class="sort-btn"
              onclick={() => handleSort(column.key as string)}
            >
              {column.label}
              {#if sortKey === column.key}
                <span class="sort-indicator">
                  {sortDirection === 'asc' ? '↑' : '↓'}
                </span>
              {/if}
            </button>
          {:else}
            {column.label}
          {/if}
        </th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#each sortedData as row}
      <tr>
        {#each columns as column}
          <td>{row[column.key]}</td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>

<style>
  .data-table {
    width: 100%;
    border-collapse: collapse;
  }

  th, td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid #ddd;
  }

  th {
    background: #f5f5f5;
    font-weight: 600;
  }

  .sort-btn {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .sort-btn:hover {
    color: #007bff;
  }

  .sort-indicator {
    font-size: 0.875rem;
  }

  tbody tr:hover {
    background: #f9f9f9;
  }
</style>
```

---

## Accordion Component

```svelte
<script lang="ts">
  interface Item {
    id: string | number;
    title: string;
    content: string;
  }

  interface Props {
    items: Item[];
    allowMultiple?: boolean;
  }

  let { items, allowMultiple = false }: Props = $props();

  let openItems = $state<Set<string | number>>(new Set());

  function toggle(id: string | number) {
    const newOpen = new Set(openItems);

    if (newOpen.has(id)) {
      newOpen.delete(id);
    } else {
      if (!allowMultiple) {
        newOpen.clear();
      }
      newOpen.add(id);
    }

    openItems = newOpen;
  }
</script>

<div class="accordion">
  {#each items as item (item.id)}
    <div class="accordion-item">
      <button
        class="accordion-header"
        onclick={() => toggle(item.id)}
        aria-expanded={openItems.has(item.id)}
      >
        <span>{item.title}</span>
        <span class="icon">
          {openItems.has(item.id) ? '−' : '+'}
        </span>
      </button>

      {#if openItems.has(item.id)}
        <div class="accordion-content">
          {item.content}
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .accordion {
    border: 1px solid #ddd;
    border-radius: 4px;
  }

  .accordion-item {
    border-bottom: 1px solid #ddd;
  }

  .accordion-item:last-child {
    border-bottom: none;
  }

  .accordion-header {
    width: 100%;
    padding: 1rem;
    background: #f5f5f5;
    border: none;
    text-align: left;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 1rem;
    transition: background 0.2s;
  }

  .accordion-header:hover {
    background: #e9e9e9;
  }

  .icon {
    font-size: 1.5rem;
    font-weight: bold;
  }

  .accordion-content {
    padding: 1rem;
    background: white;
  }
</style>
```

---

## Search/Filter Component

```svelte
<script lang="ts">
  interface Item {
    id: string | number;
    [key: string]: any;
  }

  interface Props {
    items: Item[];
    searchKeys: string[];
    placeholder?: string;
    children?: any;
  }

  let {
    items,
    searchKeys,
    placeholder = 'Search...',
    children
  }: Props = $props();

  let searchTerm = $state('');

  let filteredItems = $derived.by(() => {
    if (!searchTerm) return items;

    const term = searchTerm.toLowerCase();
    return items.filter(item =>
      searchKeys.some(key =>
        String(item[key]).toLowerCase().includes(term)
      )
    );
  });
</script>

<div class="search-container">
  <input
    type="search"
    bind:value={searchTerm}
    {placeholder}
    class="search-input"
  />

  <div class="results">
    {#if filteredItems.length > 0}
      {#each filteredItems as item (item.id)}
        {@render children?.(item)}
      {/each}
    {:else}
      <p class="no-results">No results found</p>
    {/if}
  </div>
</div>

<style>
  .search-container {
    width: 100%;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
    margin-bottom: 1rem;
  }

  .search-input:focus {
    outline: none;
    border-color: #007bff;
  }

  .results {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .no-results {
    text-align: center;
    color: #999;
    padding: 2rem;
  }
</style>
```
