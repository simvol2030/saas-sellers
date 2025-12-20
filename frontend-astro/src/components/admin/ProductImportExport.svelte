<script lang="ts">
/**
 * ProductImportExport.svelte
 * Admin UI for importing/exporting products via drag-drop and file upload
 */
import { apiFetch } from '../../lib/api';

// State
let activeTab = $state<'export' | 'import'>('export');
let isLoading = $state(false);
let error = $state<string | null>(null);
let successMessage = $state<string | null>(null);

// Export state
let exportFormat = $state<'json' | 'csv'>('json');
let exportStatus = $state<string | null>(null);
let exportCategory = $state('');
let categories = $state<Array<{ id: number; name: string }>>([]);

// Import state
let importMode = $state<'create' | 'upsert'>('upsert');
let isDragging = $state(false);
let selectedFile = $state<File | null>(null);
let importPreview = $state<{ products: any[]; valid: boolean } | null>(null);
let importResults = $state<{
  success: boolean;
  results: {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{ index: number; name: string; error: string }>;
  };
  message: string;
} | null>(null);

// Load categories on mount
$effect(() => {
  loadCategories();
});

async function loadCategories() {
  try {
    const response = await apiFetch<{ categories: Array<{ id: number; name: string }> }>('/api/admin/categories');
    categories = response.categories || [];
  } catch (e) {
    console.error('Failed to load categories:', e);
  }
}

// ==========================================
// EXPORT FUNCTIONS
// ==========================================

async function downloadExport() {
  isLoading = true;
  error = null;
  exportStatus = null;

  try {
    const params = new URLSearchParams();
    params.set('format', exportFormat);
    if (exportCategory) params.set('category', exportCategory);

    const response = await fetch(`/api/admin/products/export?${params}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        'X-Site-ID': localStorage.getItem('siteId') || '1',
      },
    });

    if (!response.ok) throw new Error('Export failed');

    const blob = await response.blob();
    const filename = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '')
      || `products-export.${exportFormat}`;

    // Download file
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();

    exportStatus = `Экспорт завершён: ${filename}`;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Ошибка экспорта';
  } finally {
    isLoading = false;
  }
}

async function downloadTemplate() {
  try {
    const response = await fetch(`/api/admin/products/export/template?format=${exportFormat}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        'X-Site-ID': localStorage.getItem('siteId') || '1',
      },
    });

    if (!response.ok) throw new Error('Failed to download template');

    const blob = await response.blob();
    const filename = `product-import-template.${exportFormat}`;

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();

    successMessage = 'Шаблон скачан';
    setTimeout(() => successMessage = null, 3000);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Ошибка загрузки шаблона';
  }
}

// ==========================================
// IMPORT FUNCTIONS
// ==========================================

function handleDragOver(e: DragEvent) {
  e.preventDefault();
  isDragging = true;
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault();
  isDragging = false;
}

function handleDrop(e: DragEvent) {
  e.preventDefault();
  isDragging = false;

  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    handleFileSelect(files[0]);
  }
}

function handleFileInput(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    handleFileSelect(input.files[0]);
  }
}

async function handleFileSelect(file: File) {
  selectedFile = file;
  importPreview = null;
  importResults = null;
  error = null;

  // Validate file type
  const isJson = file.name.endsWith('.json');
  const isCsv = file.name.endsWith('.csv');

  if (!isJson && !isCsv) {
    error = 'Поддерживаются только JSON и CSV файлы';
    selectedFile = null;
    return;
  }

  // Parse and preview
  try {
    const text = await file.text();

    if (isJson) {
      const data = JSON.parse(text);
      if (!data.products || !Array.isArray(data.products)) {
        throw new Error('JSON должен содержать массив "products"');
      }
      importPreview = {
        products: data.products,
        valid: true,
      };
    } else {
      // CSV parsing (basic)
      const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('#'));
      if (lines.length < 2) {
        throw new Error('CSV должен содержать заголовки и хотя бы одну строку данных');
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const products = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const product: Record<string, any> = {};

        headers.forEach((header, idx) => {
          if (values[idx] !== undefined && values[idx] !== '') {
            // Parse value based on header
            if (['price', 'comparePrice', 'costPrice', 'weight'].includes(header)) {
              product[header] = parseFloat(values[idx]) || 0;
            } else if (['stock', 'lowStockThreshold'].includes(header)) {
              product[header] = parseInt(values[idx]) || 0;
            } else if (['trackStock', 'featured'].includes(header)) {
              product[header] = values[idx] === 'true';
            } else if (header === 'images') {
              product[header] = values[idx].split(';').filter(Boolean).map(url => ({ url }));
            } else {
              product[header] = values[idx];
            }
          }
        });

        if (product.name && product.price !== undefined) {
          products.push(product);
        }
      }

      importPreview = {
        products,
        valid: products.length > 0,
      };
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Ошибка парсинга файла';
    importPreview = null;
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

async function runImport() {
  if (!importPreview?.valid) return;

  isLoading = true;
  error = null;
  importResults = null;

  try {
    const response = await apiFetch<{
      success: boolean;
      results: {
        total: number;
        created: number;
        updated: number;
        skipped: number;
        errors: Array<{ index: number; name: string; error: string }>;
      };
      message: string;
    }>('/api/admin/products/import', {
      method: 'POST',
      body: JSON.stringify({
        products: importPreview.products,
        mode: importMode,
      }),
    });

    importResults = response;

    if (importResults?.success) {
      successMessage = importResults.message;
      setTimeout(() => successMessage = null, 5000);
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Ошибка импорта';
  } finally {
    isLoading = false;
  }
}

function resetImport() {
  selectedFile = null;
  importPreview = null;
  importResults = null;
  error = null;
}
</script>

<div class="import-export">
  <!-- Tabs -->
  <div class="tabs">
    <button
      class="tab"
      class:active={activeTab === 'export'}
      onclick={() => activeTab = 'export'}
    >
      📤 Экспорт
    </button>
    <button
      class="tab"
      class:active={activeTab === 'import'}
      onclick={() => activeTab = 'import'}
    >
      📥 Импорт
    </button>
  </div>

  <!-- Messages -->
  {#if error}
    <div class="alert error">
      {error}
      <button class="close" onclick={() => error = null}>×</button>
    </div>
  {/if}

  {#if successMessage}
    <div class="alert success">
      {successMessage}
      <button class="close" onclick={() => successMessage = null}>×</button>
    </div>
  {/if}

  <!-- Export Tab -->
  {#if activeTab === 'export'}
    <div class="tab-content">
      <h3>Экспорт товаров</h3>
      <p class="hint">Скачайте все товары в формате JSON или CSV для резервного копирования или редактирования.</p>

      <div class="form-row">
        <label>
          <span>Формат:</span>
          <select bind:value={exportFormat}>
            <option value="json">JSON (полный)</option>
            <option value="csv">CSV (таблица)</option>
          </select>
        </label>

        <label>
          <span>Категория:</span>
          <select bind:value={exportCategory}>
            <option value="">Все категории</option>
            {#each categories as cat}
              <option value={cat.id}>{cat.name}</option>
            {/each}
          </select>
        </label>
      </div>

      <div class="actions">
        <button class="btn primary" onclick={downloadExport} disabled={isLoading}>
          {isLoading ? 'Загрузка...' : '📥 Скачать экспорт'}
        </button>
        <button class="btn secondary" onclick={downloadTemplate}>
          📋 Скачать шаблон
        </button>
      </div>

      {#if exportStatus}
        <div class="status success">{exportStatus}</div>
      {/if}
    </div>
  {/if}

  <!-- Import Tab -->
  {#if activeTab === 'import'}
    <div class="tab-content">
      <h3>Импорт товаров</h3>
      <p class="hint">Загрузите файл JSON или CSV для массового добавления/обновления товаров.</p>

      <!-- Mode selection -->
      <div class="form-row">
        <label>
          <span>Режим импорта:</span>
          <select bind:value={importMode}>
            <option value="upsert">Обновить существующие (по slug)</option>
            <option value="create">Только новые (пропустить существующие)</option>
          </select>
        </label>
      </div>

      <!-- Drop zone -->
      {#if !selectedFile}
        <div
          class="drop-zone"
          class:dragging={isDragging}
          ondragover={handleDragOver}
          ondragleave={handleDragLeave}
          ondrop={handleDrop}
          role="button"
          tabindex="0"
        >
          <div class="drop-content">
            <span class="icon">📁</span>
            <p>Перетащите файл сюда</p>
            <p class="or">или</p>
            <label class="file-input-label">
              <input
                type="file"
                accept=".json,.csv"
                onchange={handleFileInput}
              />
              Выберите файл
            </label>
            <p class="formats">Поддерживаются: JSON, CSV</p>
          </div>
        </div>
      {:else}
        <!-- File selected -->
        <div class="file-selected">
          <div class="file-info">
            <span class="file-icon">📄</span>
            <div>
              <strong>{selectedFile.name}</strong>
              <span class="size">{(selectedFile.size / 1024).toFixed(1)} KB</span>
            </div>
            <button class="btn-remove" onclick={resetImport}>×</button>
          </div>

          {#if importPreview}
            <div class="preview">
              <h4>Предпросмотр ({importPreview.products.length} товаров)</h4>
              <div class="preview-table">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Название</th>
                      <th>Slug</th>
                      <th>Цена</th>
                      <th>Остаток</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each importPreview.products.slice(0, 5) as product, i}
                      <tr>
                        <td>{i + 1}</td>
                        <td>{product.name}</td>
                        <td>{product.slug || '—'}</td>
                        <td>{product.price}</td>
                        <td>{product.stock ?? '—'}</td>
                      </tr>
                    {/each}
                    {#if importPreview.products.length > 5}
                      <tr class="more">
                        <td colspan="5">... ещё {importPreview.products.length - 5} товаров</td>
                      </tr>
                    {/if}
                  </tbody>
                </table>
              </div>

              <div class="actions">
                <button
                  class="btn primary"
                  onclick={runImport}
                  disabled={isLoading || !importPreview.valid}
                >
                  {isLoading ? 'Импортирую...' : '🚀 Начать импорт'}
                </button>
                <button class="btn secondary" onclick={resetImport}>
                  Отмена
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Import results -->
      {#if importResults}
        <div class="results" class:success={importResults.success} class:has-errors={importResults.results.errors.length > 0}>
          <h4>Результаты импорта</h4>
          <div class="stats">
            <div class="stat">
              <span class="value">{importResults.results.total}</span>
              <span class="label">Всего</span>
            </div>
            <div class="stat created">
              <span class="value">{importResults.results.created}</span>
              <span class="label">Создано</span>
            </div>
            <div class="stat updated">
              <span class="value">{importResults.results.updated}</span>
              <span class="label">Обновлено</span>
            </div>
            <div class="stat skipped">
              <span class="value">{importResults.results.skipped}</span>
              <span class="label">Пропущено</span>
            </div>
            <div class="stat errors">
              <span class="value">{importResults.results.errors.length}</span>
              <span class="label">Ошибок</span>
            </div>
          </div>

          {#if importResults.results.errors.length > 0}
            <div class="error-list">
              <h5>Ошибки:</h5>
              <ul>
                {#each importResults.results.errors as err}
                  <li>
                    <strong>#{err.index + 1} {err.name}:</strong> {err.error}
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .import-export {
    padding: 1.5rem;
  }

  .tabs {
    display: flex;
    gap: 0;
    border-bottom: 2px solid var(--border-color, #e0e0e0);
    margin-bottom: 1.5rem;
  }

  .tab {
    padding: 0.75rem 1.5rem;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 1rem;
    color: var(--text-secondary, #666);
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    transition: all 0.2s;
  }

  .tab:hover {
    color: var(--text-primary, #333);
  }

  .tab.active {
    color: var(--primary-color, #3b82f6);
    border-bottom-color: var(--primary-color, #3b82f6);
  }

  .tab-content {
    max-width: 800px;
  }

  .tab-content h3 {
    margin: 0 0 0.5rem;
    font-size: 1.25rem;
  }

  .hint {
    color: var(--text-secondary, #666);
    margin-bottom: 1.5rem;
  }

  .form-row {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .form-row label {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 200px;
  }

  .form-row label span {
    font-weight: 500;
    font-size: 0.875rem;
  }

  select {
    padding: 0.5rem;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 6px;
    font-size: 0.875rem;
    background: var(--bg-color, #fff);
  }

  .actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .btn {
    padding: 0.625rem 1.25rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn.primary {
    background: var(--primary-color, #3b82f6);
    color: white;
  }

  .btn.primary:hover:not(:disabled) {
    background: var(--primary-hover, #2563eb);
  }

  .btn.secondary {
    background: var(--bg-secondary, #f3f4f6);
    color: var(--text-primary, #333);
  }

  .btn.secondary:hover {
    background: var(--bg-tertiary, #e5e7eb);
  }

  .alert {
    padding: 0.75rem 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .alert.error {
    background: #fee2e2;
    color: #b91c1c;
    border: 1px solid #fecaca;
  }

  .alert.success {
    background: #dcfce7;
    color: #166534;
    border: 1px solid #bbf7d0;
  }

  .alert .close {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    opacity: 0.7;
  }

  .status {
    margin-top: 1rem;
    padding: 0.75rem;
    border-radius: 6px;
  }

  .status.success {
    background: #dcfce7;
    color: #166534;
  }

  /* Drop zone */
  .drop-zone {
    border: 2px dashed var(--border-color, #d1d5db);
    border-radius: 12px;
    padding: 3rem;
    text-align: center;
    transition: all 0.2s;
    background: var(--bg-secondary, #f9fafb);
  }

  .drop-zone.dragging {
    border-color: var(--primary-color, #3b82f6);
    background: #eff6ff;
  }

  .drop-content .icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 1rem;
  }

  .drop-content p {
    margin: 0.5rem 0;
    color: var(--text-secondary, #666);
  }

  .drop-content .or {
    font-size: 0.875rem;
  }

  .drop-content .formats {
    font-size: 0.75rem;
    color: var(--text-tertiary, #999);
  }

  .file-input-label {
    display: inline-block;
    padding: 0.5rem 1rem;
    background: var(--primary-color, #3b82f6);
    color: white;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
  }

  .file-input-label input {
    display: none;
  }

  /* File selected */
  .file-selected {
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 8px;
    overflow: hidden;
  }

  .file-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--bg-secondary, #f9fafb);
    border-bottom: 1px solid var(--border-color, #e0e0e0);
  }

  .file-icon {
    font-size: 2rem;
  }

  .file-info div {
    flex: 1;
  }

  .file-info strong {
    display: block;
  }

  .file-info .size {
    font-size: 0.875rem;
    color: var(--text-secondary, #666);
  }

  .btn-remove {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary, #666);
    padding: 0.25rem 0.5rem;
  }

  .btn-remove:hover {
    color: #b91c1c;
  }

  /* Preview */
  .preview {
    padding: 1rem;
  }

  .preview h4 {
    margin: 0 0 1rem;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .preview-table {
    overflow-x: auto;
    margin-bottom: 1rem;
  }

  .preview-table table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .preview-table th,
  .preview-table td {
    padding: 0.5rem;
    text-align: left;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
  }

  .preview-table th {
    background: var(--bg-secondary, #f9fafb);
    font-weight: 600;
  }

  .preview-table tr.more td {
    text-align: center;
    color: var(--text-secondary, #666);
    font-style: italic;
  }

  /* Results */
  .results {
    margin-top: 1.5rem;
    padding: 1rem;
    border-radius: 8px;
    background: var(--bg-secondary, #f9fafb);
    border: 1px solid var(--border-color, #e0e0e0);
  }

  .results.success {
    border-color: #86efac;
  }

  .results.has-errors {
    border-color: #fecaca;
  }

  .results h4 {
    margin: 0 0 1rem;
  }

  .stats {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .stat {
    text-align: center;
    padding: 0.75rem 1.25rem;
    background: white;
    border-radius: 6px;
    min-width: 80px;
  }

  .stat .value {
    display: block;
    font-size: 1.5rem;
    font-weight: 700;
  }

  .stat .label {
    font-size: 0.75rem;
    color: var(--text-secondary, #666);
  }

  .stat.created .value { color: #166534; }
  .stat.updated .value { color: #1d4ed8; }
  .stat.skipped .value { color: #92400e; }
  .stat.errors .value { color: #b91c1c; }

  .error-list {
    margin-top: 1rem;
    padding: 1rem;
    background: #fee2e2;
    border-radius: 6px;
  }

  .error-list h5 {
    margin: 0 0 0.5rem;
    color: #b91c1c;
  }

  .error-list ul {
    margin: 0;
    padding-left: 1.25rem;
  }

  .error-list li {
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
  }
</style>
