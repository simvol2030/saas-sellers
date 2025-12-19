<script lang="ts">
  /**
   * Media Gallery Component
   *
   * Displays uploaded media files with filtering, search, and selection
   */

  import { onMount } from 'svelte';
  import { apiFetch } from '../../lib/api';

  interface MediaFile {
    name: string;
    path: string;
    url: string;
    type: 'image' | 'video' | 'document';
    size: number;
    mimeType: string;
    createdAt: string;
  }

  // Props
  interface Props {
    selectable?: boolean;
    onSelect?: (file: MediaFile) => void;
    filterType?: 'image' | 'video' | 'document' | null;
  }

  let { selectable = false, onSelect = undefined, filterType = null }: Props = $props();

  // State
  let files: MediaFile[] = $state([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let typeFilter = $state<'all' | 'image' | 'video' | 'document'>(filterType || 'all');
  let selectedFile = $state<MediaFile | null>(null);
  let showUpload = $state(false);
  let uploading = $state(false);
  let uploadProgress = $state(0);
  let viewMode = $state<'grid' | 'list'>('grid');

  // Computed
  let filteredFiles = $derived(
    typeFilter === 'all'
      ? files
      : files.filter(f => f.type === typeFilter)
  );

  // Load files
  async function loadFiles() {
    loading = true;
    error = null;

    try {
      const data = await apiFetch('/api/media');
      files = data.files;
    } catch (e: any) {
      error = e.message || 'Failed to load files';
    } finally {
      loading = false;
    }
  }

  // Upload file
  async function handleUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const fileList = input.files;
    if (!fileList?.length) return;

    uploading = true;
    uploadProgress = 0;
    error = null;

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const formData = new FormData();
        formData.append('file', file);

        await apiFetch('/api/media/upload', {
          method: 'POST',
          body: formData,
        });

        uploadProgress = ((i + 1) / fileList.length) * 100;
      }

      // Reload files after upload
      await loadFiles();
      showUpload = false;
    } catch (e: any) {
      error = e.message || 'Upload failed';
    } finally {
      uploading = false;
      uploadProgress = 0;
      input.value = '';
    }
  }

  // Delete file
  async function deleteFile(file: MediaFile) {
    if (!confirm(`Удалить файл "${file.name}"?`)) return;

    try {
      await apiFetch(`/api/media${file.path}`, {
        method: 'DELETE',
      });

      files = files.filter(f => f.name !== file.name);

      if (selectedFile?.name === file.name) {
        selectedFile = null;
      }
    } catch (e: any) {
      error = e.message || 'Delete failed';
    }
  }

  // Select file
  function selectFile(file: MediaFile) {
    if (selectable) {
      selectedFile = file;
      onSelect?.(file);
    }
  }

  // Copy URL
  function copyUrl(file: MediaFile) {
    navigator.clipboard.writeText(file.url);
  }

  // Format file size
  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  // Format date
  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  // Get file icon
  function getFileIcon(file: MediaFile): string {
    if (file.type === 'image') return '🖼️';
    if (file.type === 'video') return '🎬';
    if (file.mimeType === 'application/pdf') return '📄';
    return '📎';
  }

  // Initial load
  onMount(() => {
    loadFiles();
  });
</script>

<div class="media-gallery">
  <!-- Toolbar -->
  <div class="toolbar">
    <div class="toolbar-left">
      <select bind:value={typeFilter} class="filter-select">
        <option value="all">Все файлы</option>
        <option value="image">Изображения</option>
        <option value="video">Видео</option>
        <option value="document">Документы</option>
      </select>

      <div class="view-toggle">
        <button
          type="button"
          class="view-btn"
          class:active={viewMode === 'grid'}
          onclick={() => viewMode = 'grid'}
          title="Сетка"
        >
          ⊞
        </button>
        <button
          type="button"
          class="view-btn"
          class:active={viewMode === 'list'}
          onclick={() => viewMode = 'list'}
          title="Список"
        >
          ≡
        </button>
      </div>
    </div>

    <button type="button" onclick={() => showUpload = true} class="btn btn-primary">
      📤 Загрузить
    </button>
  </div>

  <!-- Error -->
  {#if error}
    <div class="message error">{error}</div>
  {/if}

  <!-- Content -->
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <span>Загрузка файлов...</span>
    </div>
  {:else if filteredFiles.length === 0}
    <div class="empty-state">
      <div class="empty-icon">📂</div>
      <h3>Нет файлов</h3>
      <p>Загрузите первый файл</p>
      <button type="button" onclick={() => showUpload = true} class="btn btn-primary">
        Загрузить файлы
      </button>
    </div>
  {:else}
    <!-- Grid View -->
    {#if viewMode === 'grid'}
      <div class="files-grid">
        {#each filteredFiles as file (file.name)}
          <div
            class="file-card"
            class:selected={selectedFile?.name === file.name}
            onclick={() => selectFile(file)}
          >
            <div class="file-preview">
              {#if file.type === 'image'}
                <img src={file.url} alt={file.name} loading="lazy" />
              {:else if file.type === 'video'}
                <video src={file.url} preload="metadata"></video>
                <span class="file-badge">🎬</span>
              {:else}
                <span class="file-icon">{getFileIcon(file)}</span>
              {/if}
            </div>
            <div class="file-info">
              <span class="file-name" title={file.name}>{file.name}</span>
              <span class="file-meta">{formatSize(file.size)}</span>
            </div>
            <div class="file-actions">
              <button type="button" onclick={(e) => { e.stopPropagation(); copyUrl(file); }} class="action-btn" title="Копировать URL">
                📋
              </button>
              <a href={file.url} target="_blank" rel="noopener" class="action-btn" title="Открыть" onclick={(e) => e.stopPropagation()}>
                ↗
              </a>
              <button type="button" onclick={(e) => { e.stopPropagation(); deleteFile(file); }} class="action-btn action-delete" title="Удалить">
                🗑️
              </button>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <!-- List View -->
      <div class="files-list">
        <table>
          <thead>
            <tr>
              <th>Файл</th>
              <th>Тип</th>
              <th>Размер</th>
              <th>Дата</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredFiles as file (file.name)}
              <tr
                class:selected={selectedFile?.name === file.name}
                onclick={() => selectFile(file)}
              >
                <td class="file-cell">
                  <span class="file-icon-small">{getFileIcon(file)}</span>
                  <span class="file-name-text">{file.name}</span>
                </td>
                <td>{file.type}</td>
                <td>{formatSize(file.size)}</td>
                <td>{formatDate(file.createdAt)}</td>
                <td class="actions-cell">
                  <button type="button" onclick={(e) => { e.stopPropagation(); copyUrl(file); }} class="action-btn" title="Копировать URL">
                    📋
                  </button>
                  <a href={file.url} target="_blank" rel="noopener" class="action-btn" title="Открыть" onclick={(e) => e.stopPropagation()}>
                    ↗
                  </a>
                  <button type="button" onclick={(e) => { e.stopPropagation(); deleteFile(file); }} class="action-btn action-delete" title="Удалить">
                    🗑️
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}

  <!-- Upload Modal -->
  {#if showUpload}
    <div class="modal-overlay" onclick={() => !uploading && (showUpload = false)}>
      <div class="modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>Загрузка файлов</h2>
          {#if !uploading}
            <button type="button" onclick={() => showUpload = false} class="modal-close">✕</button>
          {/if}
        </div>
        <div class="modal-body">
          {#if uploading}
            <div class="upload-progress">
              <div class="progress-bar">
                <div class="progress-fill" style="width: {uploadProgress}%"></div>
              </div>
              <span>Загрузка... {Math.round(uploadProgress)}%</span>
            </div>
          {:else}
            <div class="upload-zone">
              <input
                type="file"
                id="file-input"
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx"
                onchange={handleUpload}
                class="file-input"
              />
              <label for="file-input" class="upload-label">
                <span class="upload-icon">📤</span>
                <span class="upload-text">Выберите файлы или перетащите сюда</span>
                <span class="upload-hint">Изображения, видео, PDF, DOC (до 50MB)</span>
              </label>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .media-gallery {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  /* Toolbar */
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--spacing-4);
    padding: var(--spacing-4);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-4);
  }

  .filter-select {
    padding: var(--spacing-3) var(--spacing-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-font-size-sm);
    background: var(--color-background);
    color: var(--color-text);
    cursor: pointer;
  }

  .view-toggle {
    display: flex;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .view-btn {
    padding: var(--spacing-2) var(--spacing-3);
    border: none;
    background: var(--color-background);
    cursor: pointer;
    font-size: 1.1rem;
  }

  .view-btn.active {
    background: var(--color-primary);
    color: white;
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

  /* Messages */
  .message.error {
    padding: var(--spacing-3) var(--spacing-4);
    border-radius: var(--radius-md);
    background: var(--color-error-light);
    color: var(--color-error);
    font-size: var(--font-font-size-sm);
  }

  /* Loading */
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-12);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: var(--spacing-4);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-12);
    background: var(--color-background);
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-lg);
    text-align: center;
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: var(--spacing-4);
  }

  .empty-state h3 {
    margin: 0 0 var(--spacing-2);
  }

  .empty-state p {
    margin: 0 0 var(--spacing-4);
    color: var(--color-text-muted);
  }

  /* Grid View */
  .files-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--spacing-4);
  }

  .file-card {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .file-card:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-md);
  }

  .file-card.selected {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-light);
  }

  .file-preview {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-background-secondary);
    position: relative;
  }

  .file-preview img,
  .file-preview video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .file-preview .file-icon {
    font-size: 3rem;
  }

  .file-badge {
    position: absolute;
    bottom: var(--spacing-2);
    right: var(--spacing-2);
    padding: var(--spacing-1) var(--spacing-2);
    background: rgba(0, 0, 0, 0.7);
    border-radius: var(--radius-sm);
    font-size: var(--font-font-size-xs);
  }

  .file-info {
    padding: var(--spacing-3);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
  }

  .file-name {
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-medium);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file-meta {
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
  }

  .file-actions {
    display: flex;
    gap: var(--spacing-1);
    padding: 0 var(--spacing-3) var(--spacing-3);
    justify-content: flex-end;
  }

  /* List View */
  .files-list {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .files-list table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-font-size-sm);
  }

  .files-list th,
  .files-list td {
    padding: var(--spacing-3) var(--spacing-4);
    text-align: left;
    border-bottom: 1px solid var(--color-border);
  }

  .files-list th {
    background: var(--color-background-secondary);
    font-weight: var(--font-font-weight-medium);
    color: var(--color-text-muted);
  }

  .files-list tr:last-child td {
    border-bottom: none;
  }

  .files-list tr:hover {
    background: var(--color-background-secondary);
  }

  .files-list tr.selected {
    background: var(--color-primary-light);
  }

  .file-cell {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
  }

  .file-icon-small {
    font-size: 1.2rem;
  }

  .file-name-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 300px;
  }

  .actions-cell {
    display: flex;
    gap: var(--spacing-1);
  }

  /* Action buttons */
  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: var(--radius-sm);
    font-size: 0.9rem;
    transition: background var(--transition-fast);
    text-decoration: none;
    color: inherit;
  }

  .action-btn:hover {
    background: var(--color-background-secondary);
  }

  .action-delete:hover {
    background: var(--color-error-light);
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-4);
    z-index: 1000;
  }

  .modal {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 500px;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-4) var(--spacing-6);
    border-bottom: 1px solid var(--color-border);
  }

  .modal-header h2 {
    margin: 0;
    font-size: var(--font-font-size-lg);
  }

  .modal-close {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: var(--radius-md);
    font-size: 1.2rem;
    color: var(--color-text-muted);
  }

  .modal-close:hover {
    background: var(--color-background-secondary);
    color: var(--color-text);
  }

  .modal-body {
    padding: var(--spacing-6);
  }

  /* Upload zone */
  .upload-zone {
    position: relative;
  }

  .file-input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .upload-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-8);
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-lg);
    text-align: center;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .upload-label:hover {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }

  .upload-icon {
    font-size: 3rem;
  }

  .upload-text {
    font-weight: var(--font-font-weight-medium);
  }

  .upload-hint {
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
  }

  /* Upload progress */
  .upload-progress {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-4);
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background: var(--color-background-secondary);
    border-radius: var(--radius-full);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-primary);
    transition: width 0.3s ease;
  }
</style>
