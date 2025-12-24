<script lang="ts">
  /**
   * Media Picker Component
   *
   * Modal component for selecting media files from the gallery.
   * Wraps MediaGallery with selection mode and returns selected file URL.
   */

  import MediaGallery from './MediaGallery.svelte';

  interface MediaFile {
    name: string;
    path: string;
    url: string;
    type: 'image' | 'video' | 'document';
    size: number;
    mimeType: string;
    createdAt: string;
  }

  interface Props {
    /** Current value (URL) */
    value?: string;
    /** Filter by media type */
    filterType?: 'image' | 'video' | 'document' | null;
    /** Placeholder text */
    placeholder?: string;
    /** Label for the field */
    label?: string;
    /** Callback when file is selected */
    onSelect?: (url: string) => void;
  }

  let {
    value = $bindable(''),
    filterType = null,
    placeholder = 'https://example.com/image.jpg',
    label = 'Медиафайл',
    onSelect,
  }: Props = $props();


  // State
  let showPicker = $state(false);
  let previewError = $state(false);

  // Derived
  let hasValue = $derived(value && value.trim() !== '');
  let isImage = $derived(
    hasValue &&
      (value.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ||
        value.includes('/images/'))
  );
  let isVideo = $derived(
    hasValue &&
      (value.match(/\.(mp4|webm|ogg)$/i) || value.includes('/videos/'))
  );

  // Handle file selection from gallery
  function handleSelect(file: MediaFile) {
    value = file.url;
    previewError = false;
    showPicker = false;
    onSelect?.(file.url);
  }

  // Clear value
  function clearValue() {
    value = '';
    previewError = false;
    onSelect?.('');
  }

  // Handle preview error
  function handlePreviewError() {
    previewError = true;
  }
</script>

<div class="media-picker">
  <label class="picker-label">{label}</label>

  <div class="picker-input-group">
    <input
      type="text"
      class="picker-input"
      bind:value
      {placeholder}
      oninput={() => (previewError = false)}
    />
    <button
      type="button"
      class="picker-btn"
      onclick={() => (showPicker = true)}
      title="Выбрать из галереи"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    </button>
    {#if hasValue}
      <button
        type="button"
        class="picker-btn picker-clear"
        onclick={clearValue}
        title="Очистить"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    {/if}
  </div>

  <!-- Preview -->
  {#if hasValue && !previewError}
    <div class="picker-preview">
      {#if isImage}
        <img
          src={value}
          alt="Preview"
          onerror={handlePreviewError}
          loading="lazy"
        />
      {:else if isVideo}
        <video src={value} preload="metadata" onerror={handlePreviewError}>
          <track kind="captions" />
        </video>
        <span class="preview-badge">Video</span>
      {:else}
        <div class="preview-file">
          <span class="preview-icon">📎</span>
          <span class="preview-url">{value}</span>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Picker Modal -->
  {#if showPicker}
    <div class="picker-overlay" onclick={() => (showPicker = false)}>
      <div class="picker-modal" onclick={(e) => e.stopPropagation()}>
        <div class="picker-header">
          <h3>Выбрать файл</h3>
          <button
            type="button"
            class="picker-close"
            onclick={() => (showPicker = false)}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div class="picker-body">
          <MediaGallery
            selectable={true}
            onSelect={handleSelect}
            filterType={filterType}
          />
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .media-picker {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .picker-label {
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-medium);
    color: var(--color-text);
  }

  .picker-input-group {
    display: flex;
    gap: var(--spacing-2);
  }

  .picker-input {
    flex: 1;
    padding: var(--spacing-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-font-size-sm);
    background: var(--color-background);
    color: var(--color-text);
    transition: border-color var(--transition-fast);
  }

  .picker-input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .picker-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .picker-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: var(--color-primary-light);
  }

  .picker-clear:hover {
    border-color: var(--color-error);
    color: var(--color-error);
    background: var(--color-error-light);
  }

  /* Preview */
  .picker-preview {
    position: relative;
    max-width: 200px;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--color-border);
    background: var(--color-background-secondary);
  }

  .picker-preview img,
  .picker-preview video {
    display: block;
    width: 100%;
    height: auto;
    max-height: 150px;
    object-fit: cover;
  }

  .preview-badge {
    position: absolute;
    bottom: var(--spacing-2);
    right: var(--spacing-2);
    padding: var(--spacing-1) var(--spacing-2);
    background: rgba(0, 0, 0, 0.7);
    color: white;
    font-size: var(--font-font-size-xs);
    border-radius: var(--radius-sm);
  }

  .preview-file {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-3);
  }

  .preview-icon {
    font-size: 1.5rem;
  }

  .preview-url {
    font-size: var(--font-font-size-xs);
    color: var(--color-text-secondary);
    word-break: break-all;
  }

  /* Modal */
  .picker-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-4);
    z-index: 1100;
  }

  .picker-modal {
    background: var(--color-background);
    border-radius: var(--radius-xl);
    width: 100%;
    max-width: 900px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-2xl);
  }

  .picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-4) var(--spacing-6);
    border-bottom: 1px solid var(--color-border);
  }

  .picker-header h3 {
    margin: 0;
    font-size: var(--font-font-size-lg);
    font-weight: var(--font-font-weight-semibold);
  }

  .picker-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .picker-close:hover {
    background: var(--color-background-secondary);
    color: var(--color-text);
  }

  .picker-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-4) var(--spacing-6);
  }
</style>
