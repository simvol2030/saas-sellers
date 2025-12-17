<script lang="ts">
  /**
   * Theme Editor Component
   *
   * Edit design system variables: colors, typography, spacing
   * Changes are saved to database and applied via CSS variables
   */

  import { onMount } from 'svelte';

  interface ThemeVariable {
    name: string;
    value: string;
    type: 'color' | 'size' | 'font' | 'number';
    category: string;
    label: string;
  }

  // Default theme variables
  const defaultVariables: ThemeVariable[] = [
    // Colors - Light theme
    { name: '--color-primary', value: '#3b82f6', type: 'color', category: 'colors', label: 'Primary' },
    { name: '--color-primary-hover', value: '#2563eb', type: 'color', category: 'colors', label: 'Primary Hover' },
    { name: '--color-primary-light', value: '#dbeafe', type: 'color', category: 'colors', label: 'Primary Light' },
    { name: '--color-secondary', value: '#64748b', type: 'color', category: 'colors', label: 'Secondary' },
    { name: '--color-success', value: '#22c55e', type: 'color', category: 'colors', label: 'Success' },
    { name: '--color-warning', value: '#f59e0b', type: 'color', category: 'colors', label: 'Warning' },
    { name: '--color-error', value: '#ef4444', type: 'color', category: 'colors', label: 'Error' },
    { name: '--color-info', value: '#3b82f6', type: 'color', category: 'colors', label: 'Info' },

    // Background
    { name: '--color-background', value: '#ffffff', type: 'color', category: 'background', label: 'Background' },
    { name: '--color-background-secondary', value: '#f8fafc', type: 'color', category: 'background', label: 'Background Secondary' },
    { name: '--color-background-tertiary', value: '#f1f5f9', type: 'color', category: 'background', label: 'Background Tertiary' },

    // Text
    { name: '--color-text', value: '#1e293b', type: 'color', category: 'text', label: 'Text Primary' },
    { name: '--color-text-muted', value: '#64748b', type: 'color', category: 'text', label: 'Text Muted' },
    { name: '--color-text-inverted', value: '#ffffff', type: 'color', category: 'text', label: 'Text Inverted' },

    // Border
    { name: '--color-border', value: '#e2e8f0', type: 'color', category: 'border', label: 'Border' },
    { name: '--color-border-hover', value: '#cbd5e1', type: 'color', category: 'border', label: 'Border Hover' },

    // Typography
    { name: '--font-font-family-sans', value: 'Inter, -apple-system, sans-serif', type: 'font', category: 'typography', label: 'Sans Serif Font' },
    { name: '--font-font-family-mono', value: 'JetBrains Mono, monospace', type: 'font', category: 'typography', label: 'Monospace Font' },
    { name: '--font-font-size-xs', value: '0.75rem', type: 'size', category: 'typography', label: 'Font Size XS' },
    { name: '--font-font-size-sm', value: '0.875rem', type: 'size', category: 'typography', label: 'Font Size SM' },
    { name: '--font-font-size-base', value: '1rem', type: 'size', category: 'typography', label: 'Font Size Base' },
    { name: '--font-font-size-lg', value: '1.125rem', type: 'size', category: 'typography', label: 'Font Size LG' },
    { name: '--font-font-size-xl', value: '1.25rem', type: 'size', category: 'typography', label: 'Font Size XL' },

    // Spacing
    { name: '--spacing-1', value: '0.25rem', type: 'size', category: 'spacing', label: 'Spacing 1' },
    { name: '--spacing-2', value: '0.5rem', type: 'size', category: 'spacing', label: 'Spacing 2' },
    { name: '--spacing-3', value: '0.75rem', type: 'size', category: 'spacing', label: 'Spacing 3' },
    { name: '--spacing-4', value: '1rem', type: 'size', category: 'spacing', label: 'Spacing 4' },
    { name: '--spacing-6', value: '1.5rem', type: 'size', category: 'spacing', label: 'Spacing 6' },
    { name: '--spacing-8', value: '2rem', type: 'size', category: 'spacing', label: 'Spacing 8' },

    // Border radius
    { name: '--radius-sm', value: '0.25rem', type: 'size', category: 'radius', label: 'Radius SM' },
    { name: '--radius-md', value: '0.375rem', type: 'size', category: 'radius', label: 'Radius MD' },
    { name: '--radius-lg', value: '0.5rem', type: 'size', category: 'radius', label: 'Radius LG' },
    { name: '--radius-full', value: '9999px', type: 'size', category: 'radius', label: 'Radius Full' },
  ];

  // State
  let variables: ThemeVariable[] = $state([...defaultVariables]);
  let activeCategory = $state('colors');
  let saving = $state(false);
  let success = $state<string | null>(null);
  let previewMode = $state(false);

  // Categories
  const categories = [
    { id: 'colors', name: 'Цвета', icon: '🎨' },
    { id: 'background', name: 'Фон', icon: '🖼️' },
    { id: 'text', name: 'Текст', icon: '📝' },
    { id: 'border', name: 'Границы', icon: '⬜' },
    { id: 'typography', name: 'Типографика', icon: '🔤' },
    { id: 'spacing', name: 'Отступы', icon: '↔️' },
    { id: 'radius', name: 'Скругления', icon: '⭕' },
  ];

  // Filtered variables
  let filteredVariables = $derived(
    variables.filter(v => v.category === activeCategory)
  );

  // Apply preview
  function applyPreview() {
    variables.forEach(v => {
      document.documentElement.style.setProperty(v.name, v.value);
    });
  }

  // Reset variable to default
  function resetVariable(name: string) {
    const defaultVar = defaultVariables.find(v => v.name === name);
    if (defaultVar) {
      const idx = variables.findIndex(v => v.name === name);
      if (idx !== -1) {
        variables[idx].value = defaultVar.value;
        if (previewMode) applyPreview();
      }
    }
  }

  // Reset all to defaults
  function resetAll() {
    if (!confirm('Сбросить все настройки темы к значениям по умолчанию?')) return;
    variables = [...defaultVariables];
    if (previewMode) applyPreview();
    success = 'Настройки сброшены';
  }

  // Save theme
  async function saveTheme() {
    saving = true;
    success = null;

    try {
      // For now, save to localStorage
      // In production, this would save to the database
      const themeData = variables.reduce((acc, v) => {
        acc[v.name] = v.value;
        return acc;
      }, {} as Record<string, string>);

      localStorage.setItem('themeOverrides', JSON.stringify(themeData));
      applyPreview();
      success = 'Тема сохранена';
    } catch (e) {
      console.error('Save error:', e);
    } finally {
      saving = false;
    }
  }

  // Generate CSS
  function generateCSS(): string {
    let css = ':root {\n';
    variables.forEach(v => {
      css += `  ${v.name}: ${v.value};\n`;
    });
    css += '}';
    return css;
  }

  // Export CSS
  function exportCSS() {
    const css = generateCSS();
    const blob = new Blob([css], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'theme-overrides.css';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Load saved theme
  function loadSavedTheme() {
    try {
      const saved = localStorage.getItem('themeOverrides');
      if (saved) {
        const themeData = JSON.parse(saved) as Record<string, string>;
        variables = variables.map(v => ({
          ...v,
          value: themeData[v.name] || v.value,
        }));
      }
    } catch (e) {
      console.error('Load error:', e);
    }
  }

  // Toggle preview
  function togglePreview() {
    previewMode = !previewMode;
    if (previewMode) {
      applyPreview();
    } else {
      // Reload page styles
      loadSavedTheme();
      applyPreview();
    }
  }

  // Handle color change
  function handleColorChange(index: number, value: string) {
    variables[index].value = value;
    if (previewMode) {
      document.documentElement.style.setProperty(variables[index].name, value);
    }
  }

  // Initial load
  onMount(() => {
    loadSavedTheme();
  });
</script>

<div class="theme-editor">
  <!-- Header -->
  <div class="editor-header">
    <div class="header-left">
      <h1 class="editor-title">🎨 Редактор темы</h1>
      <p class="editor-description">Настройка цветов, типографики и отступов</p>
    </div>
    <div class="header-actions">
      <button
        type="button"
        onclick={togglePreview}
        class="btn btn-outline"
        class:active={previewMode}
      >
        {previewMode ? '✓ Предпросмотр' : '👁️ Предпросмотр'}
      </button>
      <button
        type="button"
        onclick={exportCSS}
        class="btn btn-outline"
      >
        📥 Экспорт CSS
      </button>
      <button
        type="button"
        onclick={resetAll}
        class="btn btn-outline"
      >
        🔄 Сброс
      </button>
      <button
        type="button"
        onclick={saveTheme}
        disabled={saving}
        class="btn btn-primary"
      >
        {saving ? 'Сохранение...' : '💾 Сохранить'}
      </button>
    </div>
  </div>

  <!-- Success message -->
  {#if success}
    <div class="message success">{success}</div>
  {/if}

  <div class="editor-layout">
    <!-- Categories sidebar -->
    <div class="categories-sidebar">
      {#each categories as category}
        <button
          type="button"
          class="category-btn"
          class:active={activeCategory === category.id}
          onclick={() => activeCategory = category.id}
        >
          <span class="category-icon">{category.icon}</span>
          <span class="category-name">{category.name}</span>
          <span class="category-count">
            {variables.filter(v => v.category === category.id).length}
          </span>
        </button>
      {/each}
    </div>

    <!-- Variables editor -->
    <div class="variables-editor">
      <div class="variables-grid">
        {#each filteredVariables as variable, index}
          <div class="variable-card">
            <div class="variable-header">
              <label class="variable-label">{variable.label}</label>
              <button
                type="button"
                onclick={() => resetVariable(variable.name)}
                class="reset-btn"
                title="Сбросить к значению по умолчанию"
              >
                ↺
              </button>
            </div>
            <div class="variable-input">
              {#if variable.type === 'color'}
                <div class="color-input-wrapper">
                  <input
                    type="color"
                    value={variable.value}
                    onchange={(e) => handleColorChange(
                      variables.findIndex(v => v.name === variable.name),
                      (e.target as HTMLInputElement).value
                    )}
                    class="color-picker"
                  />
                  <input
                    type="text"
                    value={variable.value}
                    oninput={(e) => handleColorChange(
                      variables.findIndex(v => v.name === variable.name),
                      (e.target as HTMLInputElement).value
                    )}
                    class="form-input color-text"
                    placeholder="#000000"
                  />
                </div>
              {:else}
                <input
                  type="text"
                  bind:value={variable.value}
                  class="form-input"
                  placeholder={variable.type === 'size' ? '1rem' : ''}
                />
              {/if}
            </div>
            <div class="variable-name">
              <code>{variable.name}</code>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Preview panel -->
  {#if previewMode}
    <div class="preview-panel">
      <h3>Предпросмотр компонентов</h3>
      <div class="preview-components">
        <div class="preview-section">
          <h4>Кнопки</h4>
          <div class="preview-buttons">
            <button class="btn btn-primary">Primary</button>
            <button class="btn btn-secondary">Secondary</button>
            <button class="btn btn-outline">Outline</button>
          </div>
        </div>

        <div class="preview-section">
          <h4>Статусы</h4>
          <div class="preview-badges">
            <span class="badge badge-success">Успех</span>
            <span class="badge badge-warning">Внимание</span>
            <span class="badge badge-error">Ошибка</span>
            <span class="badge badge-info">Инфо</span>
          </div>
        </div>

        <div class="preview-section">
          <h4>Карточка</h4>
          <div class="preview-card">
            <h5>Заголовок карточки</h5>
            <p>Текст внутри карточки с описанием.</p>
            <button class="btn btn-primary btn-sm">Действие</button>
          </div>
        </div>

        <div class="preview-section">
          <h4>Форма</h4>
          <div class="preview-form">
            <input type="text" placeholder="Текстовое поле" class="form-input" />
            <select class="form-select">
              <option>Выберите опцию</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .theme-editor {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-6);
  }

  /* Header */
  .editor-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--spacing-4);
  }

  .editor-title {
    margin: 0;
    font-size: var(--font-font-size-xl);
  }

  .editor-description {
    margin: var(--spacing-1) 0 0;
    color: var(--color-text-muted);
    font-size: var(--font-font-size-sm);
  }

  .header-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
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
    background: var(--color-secondary);
    color: white;
  }

  .btn-outline {
    background: transparent;
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  .btn-outline:hover,
  .btn-outline.active {
    background: var(--color-background-secondary);
    border-color: var(--color-primary);
  }

  .btn-sm {
    padding: var(--spacing-2) var(--spacing-4);
    font-size: var(--font-font-size-xs);
  }

  /* Message */
  .message.success {
    padding: var(--spacing-3) var(--spacing-4);
    border-radius: var(--radius-md);
    background: var(--color-success-light);
    color: var(--color-success);
    font-size: var(--font-font-size-sm);
  }

  /* Layout */
  .editor-layout {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: var(--spacing-6);
  }

  @media (max-width: 768px) {
    .editor-layout {
      grid-template-columns: 1fr;
    }
  }

  /* Categories sidebar */
  .categories-sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .category-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-3) var(--spacing-4);
    border: none;
    background: transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    text-align: left;
    transition: all var(--transition-fast);
  }

  .category-btn:hover {
    background: var(--color-background-secondary);
  }

  .category-btn.active {
    background: var(--color-primary);
    color: white;
  }

  .category-icon {
    font-size: 1.2rem;
  }

  .category-name {
    flex: 1;
    font-weight: var(--font-font-weight-medium);
  }

  .category-count {
    font-size: var(--font-font-size-xs);
    padding: var(--spacing-1) var(--spacing-2);
    background: var(--color-background-secondary);
    border-radius: var(--radius-full);
  }

  .category-btn.active .category-count {
    background: rgba(255, 255, 255, 0.2);
  }

  /* Variables editor */
  .variables-editor {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-6);
  }

  .variables-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: var(--spacing-4);
  }

  .variable-card {
    background: var(--color-background-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--spacing-4);
  }

  .variable-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-2);
  }

  .variable-label {
    font-weight: var(--font-font-weight-medium);
    font-size: var(--font-font-size-sm);
  }

  .reset-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: var(--radius-sm);
    font-size: 1rem;
    color: var(--color-text-muted);
  }

  .reset-btn:hover {
    background: var(--color-background);
    color: var(--color-text);
  }

  .variable-input {
    margin-bottom: var(--spacing-2);
  }

  .color-input-wrapper {
    display: flex;
    gap: var(--spacing-2);
  }

  .color-picker {
    width: 44px;
    height: 38px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    padding: 2px;
  }

  .color-text {
    flex: 1;
    font-family: var(--font-font-family-mono);
  }

  .form-input,
  .form-select {
    width: 100%;
    padding: var(--spacing-2) var(--spacing-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-font-size-sm);
    background: var(--color-background);
    color: var(--color-text);
  }

  .form-input:focus,
  .form-select:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .variable-name {
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
  }

  .variable-name code {
    font-family: var(--font-font-family-mono);
    background: var(--color-background);
    padding: var(--spacing-1) var(--spacing-2);
    border-radius: var(--radius-sm);
  }

  /* Preview panel */
  .preview-panel {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-6);
  }

  .preview-panel h3 {
    margin: 0 0 var(--spacing-4);
    font-size: var(--font-font-size-lg);
  }

  .preview-components {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-6);
  }

  .preview-section h4 {
    margin: 0 0 var(--spacing-3);
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
  }

  .preview-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
  }

  .preview-badges {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
  }

  .badge {
    display: inline-block;
    padding: var(--spacing-1) var(--spacing-3);
    border-radius: var(--radius-full);
    font-size: var(--font-font-size-xs);
    font-weight: var(--font-font-weight-medium);
  }

  .badge-success {
    background: var(--color-success-light);
    color: var(--color-success);
  }

  .badge-warning {
    background: var(--color-warning-light);
    color: var(--color-warning);
  }

  .badge-error {
    background: var(--color-error-light);
    color: var(--color-error);
  }

  .badge-info {
    background: var(--color-info-light);
    color: var(--color-info);
  }

  .preview-card {
    background: var(--color-background-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--spacing-4);
  }

  .preview-card h5 {
    margin: 0 0 var(--spacing-2);
  }

  .preview-card p {
    margin: 0 0 var(--spacing-3);
    color: var(--color-text-muted);
    font-size: var(--font-font-size-sm);
  }

  .preview-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }
</style>
