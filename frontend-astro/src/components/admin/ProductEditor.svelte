<script lang="ts">
  /**
   * Product Editor Component
   *
   * Create and edit products with:
   * - Basic info, SEO
   * - Multi-currency pricing
   * - Stock management
   * - Category assignment
   * - Image upload
   * - Variants (optional)
   */

  import { onMount } from 'svelte';
  import { apiFetch } from '../../lib/api';

  interface Props {
    productId?: number;
  }

  let { productId }: Props = $props();

  interface Category {
    id: number;
    name: string;
    slug: string;
    level: number;
  }

  interface Currency {
    id: number;
    code: string;
    symbol: string;
    name: string;
    isDefault: boolean;
  }

  interface ProductImage {
    id?: number;
    url: string;
    alt: string;
    position: number;
  }

  interface ProductVariant {
    id?: number;
    name: string;
    sku: string;
    prices: Record<string, number>;
    stock: number;
    options: Record<string, string>;
    isActive: boolean;
  }

  // State
  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let notification = $state<{ type: 'success' | 'error'; message: string } | null>(null);

  // Reference data
  let categories: Category[] = $state([]);
  let currencies: Currency[] = $state([]);
  let defaultCurrency = $state<string>('RUB');

  // Form data
  let formData = $state({
    name: '',
    slug: '',
    sku: '',
    description: '',
    shortDescription: '',
    prices: {} as Record<string, number>,
    compareAtPrices: {} as Record<string, number>,
    costPrice: null as number | null,
    productType: 'general' as string,
    status: 'draft' as 'draft' | 'active' | 'archived',
    visibility: 'visible' as 'visible' | 'hidden' | 'catalog' | 'search',
    stock: 0,
    lowStockThreshold: 5,
    manageStock: true,
    weight: null as number | null,
    seoTitle: '',
    seoDescription: '',
    featured: false,
    categoryId: null as number | null,
  });

  let images: ProductImage[] = $state([]);
  let variants: ProductVariant[] = $state([]);
  let showVariants = $state(false);

  // Product types
  const productTypes = [
    { value: 'general', label: 'Общий' },
    { value: 'clothing', label: 'Одежда' },
    { value: 'food', label: 'Еда' },
    { value: 'cafe', label: 'Кафе' },
    { value: 'pet', label: 'Зоотовары' },
    { value: 'household', label: 'Бытовые товары' },
  ];

  // Status options
  const statusOptions = [
    { value: 'draft', label: 'Черновик' },
    { value: 'active', label: 'Активный' },
    { value: 'archived', label: 'Архивирован' },
  ];

  // Visibility options
  const visibilityOptions = [
    { value: 'visible', label: 'Видим везде' },
    { value: 'hidden', label: 'Скрыт' },
    { value: 'catalog', label: 'Только в каталоге' },
    { value: 'search', label: 'Только в поиске' },
  ];

  // Show notification
  function showNotification(type: 'success' | 'error', message: string) {
    notification = { type, message };
    setTimeout(() => {
      notification = null;
    }, 5000);
  }

  // Generate slug from name
  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[а-яё]/gi, (char) => {
        const ru = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
        const en = 'abvgdeejzijklmnoprstufhcchshschyieyuya';
        const i = ru.indexOf(char.toLowerCase());
        return i >= 0 ? en[i] : char;
      })
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  // Handle name change - auto-generate slug for new products
  function handleNameChange() {
    if (!productId) {
      formData.slug = generateSlug(formData.name);
    }
  }

  // Load reference data
  async function loadReferenceData() {
    try {
      const [categoriesData, currenciesData] = await Promise.all([
        apiFetch<{ categories: Category[] }>('/api/admin/categories'),
        apiFetch<Currency[]>('/api/admin/currencies'),
      ]);

      categories = categoriesData.categories || [];
      currencies = currenciesData;

      const defCurr = currencies.find(c => c.isDefault);
      if (defCurr) {
        defaultCurrency = defCurr.code;
      }

      // Initialize prices for all currencies
      currencies.forEach(curr => {
        if (formData.prices[curr.code] === undefined) {
          formData.prices[curr.code] = 0;
        }
      });
    } catch (e) {
      console.error('Failed to load reference data:', e);
    }
  }

  // Load existing product
  async function loadProduct() {
    if (!productId) {
      loading = false;
      return;
    }

    try {
      const product = await apiFetch<any>(`/api/admin/products/${productId}`);

      formData = {
        name: product.name,
        slug: product.slug,
        sku: product.sku || '',
        description: product.description || '',
        shortDescription: product.shortDescription || '',
        prices: product.prices || {},
        compareAtPrices: product.compareAtPrices || {},
        costPrice: product.costPrice,
        productType: product.productType,
        status: product.status,
        visibility: product.visibility,
        stock: product.stock,
        lowStockThreshold: product.lowStockThreshold,
        manageStock: product.manageStock,
        weight: product.weight,
        seoTitle: product.seoTitle || '',
        seoDescription: product.seoDescription || '',
        featured: product.featured,
        categoryId: product.categoryId,
      };

      images = product.images || [];
      variants = product.variants || [];
      showVariants = variants.length > 0;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Ошибка загрузки товара';
    } finally {
      loading = false;
    }
  }

  // Save product
  async function saveProduct() {
    if (!formData.name.trim()) {
      showNotification('error', 'Введите название товара');
      return;
    }

    saving = true;

    try {
      const payload = {
        ...formData,
        slug: formData.slug.trim() || generateSlug(formData.name),
        sku: formData.sku.trim() || null,
        description: formData.description.trim() || null,
        shortDescription: formData.shortDescription.trim() || null,
        seoTitle: formData.seoTitle.trim() || null,
        seoDescription: formData.seoDescription.trim() || null,
        images: images.map((img, idx) => ({
          ...img,
          position: idx,
        })),
        variants: showVariants ? variants : [],
      };

      let result;
      if (productId) {
        result = await apiFetch(`/api/admin/products/${productId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showNotification('success', 'Товар сохранён');
      } else {
        result = await apiFetch('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showNotification('success', 'Товар создан');

        // Redirect to edit page
        setTimeout(() => {
          window.location.href = `/admin/products/${result.id}`;
        }, 1000);
      }
    } catch (e: any) {
      console.error('Save error:', e);
      showNotification('error', e.message || 'Ошибка сохранения');
    } finally {
      saving = false;
    }
  }

  // Image upload
  async function handleImageUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    const formDataUpload = new FormData();
    for (let i = 0; i < files.length; i++) {
      formDataUpload.append('files', files[i]);
    }

    try {
      const result = await apiFetch<{ files: Array<{ url: string }> }>('/api/media', {
        method: 'POST',
        body: formDataUpload,
      });

      result.files.forEach(file => {
        images.push({
          url: file.url,
          alt: '',
          position: images.length,
        });
      });
      images = [...images];
    } catch (e) {
      console.error('Upload error:', e);
      showNotification('error', 'Ошибка загрузки изображений');
    }
  }

  // Remove image
  function removeImage(index: number) {
    images.splice(index, 1);
    images = [...images];
  }

  // Add variant
  function addVariant() {
    const newVariant: ProductVariant = {
      name: '',
      sku: '',
      prices: {},
      stock: 0,
      options: {},
      isActive: true,
    };

    // Copy prices from main product
    currencies.forEach(curr => {
      newVariant.prices[curr.code] = formData.prices[curr.code] || 0;
    });

    variants.push(newVariant);
    variants = [...variants];
  }

  // Remove variant
  function removeVariant(index: number) {
    variants.splice(index, 1);
    variants = [...variants];
  }

  // Initialize
  onMount(async () => {
    await loadReferenceData();
    await loadProduct();
  });
</script>

<div class="product-editor">
  <!-- Notification -->
  {#if notification}
    <div class="notification notification-{notification.type}">
      {notification.message}
      <button
        type="button"
        class="notification-close"
        onclick={() => notification = null}
      >
        ×
      </button>
    </div>
  {/if}

  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <span>Загрузка...</span>
    </div>
  {:else if error}
    <div class="error-message">
      <p>{error}</p>
      <a href="/admin/products" class="btn btn-secondary">Назад к списку</a>
    </div>
  {:else}
    <!-- Header -->
    <div class="editor-header">
      <a href="/admin/products" class="back-link">← Назад к товарам</a>
      <h1>{productId ? 'Редактирование товара' : 'Новый товар'}</h1>
      <div class="header-actions">
        <select bind:value={formData.status} class="status-select">
          {#each statusOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
        <button onclick={saveProduct} class="btn btn-primary" disabled={saving}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>

    <div class="editor-content">
      <!-- Main column -->
      <div class="main-column">
        <!-- Basic Info -->
        <section class="card">
          <h2 class="card-title">Основная информация</h2>

          <div class="form-group">
            <label for="name">Название товара *</label>
            <input
              type="text"
              id="name"
              bind:value={formData.name}
              oninput={handleNameChange}
              placeholder="Название товара"
              class="form-input"
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="slug">Slug (URL)</label>
              <input
                type="text"
                id="slug"
                bind:value={formData.slug}
                placeholder="product-slug"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="sku">Артикул (SKU)</label>
              <input
                type="text"
                id="sku"
                bind:value={formData.sku}
                placeholder="SKU-001"
                class="form-input"
              />
            </div>
          </div>

          <div class="form-group">
            <label for="shortDesc">Краткое описание</label>
            <textarea
              id="shortDesc"
              bind:value={formData.shortDescription}
              placeholder="Краткое описание для карточки товара"
              class="form-input"
              rows="2"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="description">Полное описание</label>
            <textarea
              id="description"
              bind:value={formData.description}
              placeholder="Подробное описание товара"
              class="form-input"
              rows="6"
            ></textarea>
          </div>
        </section>

        <!-- Pricing -->
        <section class="card">
          <h2 class="card-title">Цены</h2>

          <div class="prices-grid">
            {#each currencies as currency (currency.id)}
              <div class="price-group">
                <label>{currency.name} ({currency.symbol})</label>
                <div class="price-inputs">
                  <input
                    type="number"
                    bind:value={formData.prices[currency.code]}
                    placeholder="Цена"
                    class="form-input"
                    step="0.01"
                    min="0"
                  />
                  <input
                    type="number"
                    bind:value={formData.compareAtPrices[currency.code]}
                    placeholder="Старая цена"
                    class="form-input compare-price"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
            {/each}
          </div>

          <div class="form-group">
            <label for="costPrice">Себестоимость ({defaultCurrency})</label>
            <input
              type="number"
              id="costPrice"
              bind:value={formData.costPrice}
              placeholder="Себестоимость"
              class="form-input"
              style="max-width: 200px"
              step="0.01"
              min="0"
            />
          </div>
        </section>

        <!-- Images -->
        <section class="card">
          <h2 class="card-title">Изображения</h2>

          <div class="images-grid">
            {#each images as image, index (index)}
              <div class="image-item">
                <img src={image.url} alt={image.alt || 'Товар'} />
                <button
                  onclick={() => removeImage(index)}
                  class="image-remove"
                  title="Удалить"
                >
                  ×
                </button>
              </div>
            {/each}

            <label class="image-upload">
              <input
                type="file"
                accept="image/*"
                multiple
                onchange={handleImageUpload}
              />
              <span class="upload-icon">📷</span>
              <span class="upload-text">Добавить</span>
            </label>
          </div>
        </section>

        <!-- Variants -->
        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Варианты товара</h2>
            <label class="toggle-label">
              <input type="checkbox" bind:checked={showVariants} />
              <span>Товар с вариантами</span>
            </label>
          </div>

          {#if showVariants}
            <div class="variants-list">
              {#each variants as variant, index (index)}
                <div class="variant-item">
                  <div class="variant-header">
                    <span class="variant-number">Вариант {index + 1}</span>
                    <button
                      onclick={() => removeVariant(index)}
                      class="btn-icon"
                      title="Удалить"
                    >
                      🗑️
                    </button>
                  </div>
                  <div class="variant-fields">
                    <input
                      type="text"
                      bind:value={variant.name}
                      placeholder="Название варианта"
                      class="form-input"
                    />
                    <input
                      type="text"
                      bind:value={variant.sku}
                      placeholder="SKU"
                      class="form-input"
                    />
                    <input
                      type="number"
                      bind:value={variant.stock}
                      placeholder="Остаток"
                      class="form-input"
                      min="0"
                    />
                  </div>
                </div>
              {/each}

              <button onclick={addVariant} class="btn btn-secondary">
                ➕ Добавить вариант
              </button>
            </div>
          {/if}
        </section>

        <!-- SEO -->
        <section class="card">
          <h2 class="card-title">SEO</h2>

          <div class="form-group">
            <label for="seoTitle">SEO заголовок</label>
            <input
              type="text"
              id="seoTitle"
              bind:value={formData.seoTitle}
              placeholder="Заголовок для поисковых систем"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="seoDesc">SEO описание</label>
            <textarea
              id="seoDesc"
              bind:value={formData.seoDescription}
              placeholder="Описание для поисковых систем"
              class="form-input"
              rows="3"
            ></textarea>
          </div>
        </section>
      </div>

      <!-- Sidebar -->
      <div class="sidebar-column">
        <!-- Category -->
        <section class="card">
          <h2 class="card-title">Категория</h2>
          <select bind:value={formData.categoryId} class="form-input">
            <option value={null}>— Без категории —</option>
            {#each categories as cat (cat.id)}
              <option value={cat.id}>
                {'—'.repeat(cat.level)} {cat.name}
              </option>
            {/each}
          </select>
        </section>

        <!-- Product Type -->
        <section class="card">
          <h2 class="card-title">Тип товара</h2>
          <select bind:value={formData.productType} class="form-input">
            {#each productTypes as pt}
              <option value={pt.value}>{pt.label}</option>
            {/each}
          </select>
        </section>

        <!-- Visibility -->
        <section class="card">
          <h2 class="card-title">Видимость</h2>
          <select bind:value={formData.visibility} class="form-input">
            {#each visibilityOptions as vo}
              <option value={vo.value}>{vo.label}</option>
            {/each}
          </select>

          <label class="checkbox-label">
            <input type="checkbox" bind:checked={formData.featured} />
            <span>Рекомендуемый товар</span>
          </label>
        </section>

        <!-- Stock -->
        <section class="card">
          <h2 class="card-title">Склад</h2>

          <label class="checkbox-label">
            <input type="checkbox" bind:checked={formData.manageStock} />
            <span>Отслеживать остатки</span>
          </label>

          {#if formData.manageStock}
            <div class="form-group">
              <label for="stock">Количество на складе</label>
              <input
                type="number"
                id="stock"
                bind:value={formData.stock}
                class="form-input"
                min="0"
              />
            </div>

            <div class="form-group">
              <label for="lowStock">Мин. остаток (уведомление)</label>
              <input
                type="number"
                id="lowStock"
                bind:value={formData.lowStockThreshold}
                class="form-input"
                min="0"
              />
            </div>
          {/if}
        </section>

        <!-- Weight -->
        <section class="card">
          <h2 class="card-title">Доставка</h2>

          <div class="form-group">
            <label for="weight">Вес (грамм)</label>
            <input
              type="number"
              id="weight"
              bind:value={formData.weight}
              placeholder="Вес товара"
              class="form-input"
              min="0"
            />
          </div>
        </section>
      </div>
    </div>
  {/if}
</div>

<style>
  .product-editor {
    max-width: 1200px;
  }

  /* Loading & Error */
  .loading,
  .error-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-12);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    text-align: center;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Header */
  .editor-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-4);
    margin-bottom: var(--spacing-6);
    flex-wrap: wrap;
  }

  .back-link {
    color: var(--color-text-muted);
    text-decoration: none;
    font-size: var(--font-font-size-sm);
  }

  .back-link:hover {
    color: var(--color-primary);
  }

  .editor-header h1 {
    flex: 1;
    margin: 0;
    font-size: var(--font-font-size-xl);
  }

  .header-actions {
    display: flex;
    gap: var(--spacing-3);
  }

  .status-select {
    padding: var(--spacing-2) var(--spacing-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    color: var(--color-text);
    font-size: var(--font-font-size-sm);
  }

  /* Content layout */
  .editor-content {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: var(--spacing-6);
  }

  @media (max-width: 900px) {
    .editor-content {
      grid-template-columns: 1fr;
    }
  }

  .main-column {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .sidebar-column {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  /* Cards */
  .card {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-5);
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-4);
  }

  .card-title {
    margin: 0 0 var(--spacing-4);
    font-size: var(--font-font-size-md);
    font-weight: var(--font-font-weight-semibold);
  }

  .card-header .card-title {
    margin-bottom: 0;
  }

  /* Form elements */
  .form-group {
    margin-bottom: var(--spacing-4);
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .form-group label {
    display: block;
    margin-bottom: var(--spacing-2);
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-medium);
    color: var(--color-text);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-4);
  }

  .form-input {
    width: 100%;
    padding: var(--spacing-3) var(--spacing-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-font-size-sm);
    background: var(--color-background);
    color: var(--color-text);
  }

  .form-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
  }

  textarea.form-input {
    resize: vertical;
    min-height: 80px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    margin-top: var(--spacing-3);
    cursor: pointer;
    font-size: var(--font-font-size-sm);
  }

  .checkbox-label input {
    width: 18px;
    height: 18px;
    accent-color: var(--color-primary);
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    cursor: pointer;
    font-size: var(--font-font-size-sm);
  }

  .toggle-label input {
    width: 18px;
    height: 18px;
    accent-color: var(--color-primary);
  }

  /* Prices */
  .prices-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-4);
    margin-bottom: var(--spacing-4);
  }

  .price-group label {
    display: block;
    margin-bottom: var(--spacing-2);
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-medium);
  }

  .price-inputs {
    display: flex;
    gap: var(--spacing-2);
  }

  .price-inputs .form-input {
    flex: 1;
  }

  .compare-price {
    opacity: 0.7;
  }

  /* Images */
  .images-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: var(--spacing-3);
  }

  .image-item {
    position: relative;
    aspect-ratio: 1;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--color-border);
  }

  .image-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .image-remove {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    border: none;
    border-radius: var(--radius-full);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
  }

  .image-remove:hover {
    background: var(--color-error);
  }

  .image-upload {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .image-upload:hover {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }

  .image-upload input {
    display: none;
  }

  .upload-icon {
    font-size: 1.5rem;
    margin-bottom: var(--spacing-1);
  }

  .upload-text {
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
  }

  /* Variants */
  .variants-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .variant-item {
    padding: var(--spacing-4);
    background: var(--color-background-secondary);
    border-radius: var(--radius-md);
  }

  .variant-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-3);
  }

  .variant-number {
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-medium);
  }

  .variant-fields {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: var(--spacing-2);
  }

  .btn-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: var(--radius-md);
    font-size: 1rem;
  }

  .btn-icon:hover {
    background: var(--color-error-light);
  }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-3) var(--spacing-5);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-medium);
    text-decoration: none;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  .btn-primary:hover {
    background: var(--color-primary-hover);
  }

  .btn-secondary {
    background: var(--color-background-secondary);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  .btn-secondary:hover {
    background: var(--color-background-tertiary);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Notification */
  .notification {
    position: fixed;
    top: var(--spacing-4);
    right: var(--spacing-4);
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-4) var(--spacing-5);
    border-radius: var(--radius-lg);
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-medium);
    box-shadow: var(--shadow-xl);
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .notification-success {
    background: var(--color-success);
    color: white;
  }

  .notification-error {
    background: var(--color-error);
    color: white;
  }

  .notification-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    font-size: 1.5rem;
    line-height: 1;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .notification-close:hover {
    background: rgba(255, 255, 255, 0.3);
  }
</style>
