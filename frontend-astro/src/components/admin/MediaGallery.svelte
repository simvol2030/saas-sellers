<script lang="ts">
  /**
   * Media Gallery Component
   *
   * Displays uploaded media files with folder navigation, filtering, and selection
   */

  import { onMount } from 'svelte';
  import { apiFetch } from '../../lib/api';

  interface MediaFile {
    id: number;
    filename: string;
    originalName: string;
    path: string;
    url: string;
    type: 'image' | 'video' | 'document';
    size: number;
    mimeType: string;
    folderId: number | null;
    folder?: { id: number; name: string; slug: string } | null;
    createdAt: string;
  }

  interface MediaFolder {
    id: number;
    name: string;
    slug: string;
    parentId: number | null;
    parent?: { id: number; name: string; slug: string } | null;
    children?: MediaFolder[];
    mediaCount?: number;
    childCount?: number;
    _count?: { media: number; children: number };
  }

  // Props
  interface Props {
    selectable?: boolean;
    onSelect?: (file: MediaFile) => void;
    filterType?: 'image' | 'video' | 'document' | null;
  }

  let { selectable = false, onSelect, filterType = null }: Props = $props();

  // State
  let files: MediaFile[] = $state([]);
  let folders: MediaFolder[] = $state([]);
  let currentFolderId: number | null = $state(null);
  let currentFolder: MediaFolder | null = $state(null);
  let breadcrumbs: MediaFolder[] = $state([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let typeFilter = $state<'all' | 'image' | 'video' | 'document'>(filterType || 'all');
  let selectedFile = $state<MediaFile | null>(null);
  let showUpload = $state(false);
  let showCreateFolder = $state(false);
  let uploading = $state(false);
  let uploadProgress = $state(0);
  let viewMode = $state<'grid' | 'list'>('grid');
  let notification = $state<{ type: 'success' | 'error'; message: string } | null>(null);
  let showFolderSidebar = $state(true);
  let folderTree: MediaFolder[] = $state([]);

  // New folder form
  let newFolderName = $state('');
  let newFolderSlug = $state('');
  let creatingFolder = $state(false);

  // Computed
  let filteredFiles = $derived(
    typeFilter === 'all'
      ? files
      : files.filter(f => f.type === typeFilter)
  );

  // Show notification
  function showNotification(type: 'success' | 'error', message: string) {
    notification = { type, message };
    setTimeout(() => {
      notification = null;
    }, 5000);
  }

  // Load folder tree
  async function loadFolderTree() {
    try {
      const data = await apiFetch<{ folders: MediaFolder[] }>('/api/admin/media/folders?tree=true');
      folderTree = data.folders;
    } catch (e) {
      console.error('Error loading folder tree:', e);
    }
  }

  // Load current folder contents
  async function loadFolder(folderId: number | null = null) {
    loading = true;
    error = null;

    try {
      // Load subfolders
      const folderUrl = folderId
        ? `/api/admin/media/folders?parentId=${folderId}`
        : '/api/admin/media/folders?parentId=null';
      const foldersData = await apiFetch<{ folders: MediaFolder[] }>(folderUrl);
      folders = foldersData.folders;

      // Load files
      const filesUrl = folderId
        ? `/api/admin/media?folderId=${folderId}`
        : '/api/admin/media?folderId=';
      const filesData = await apiFetch<{ files: MediaFile[] }>(filesUrl);
      files = filesData.files;

      // Load current folder info and build breadcrumbs
      if (folderId) {
        const folderData = await apiFetch<{ folder: MediaFolder }>(`/api/admin/media/folders/${folderId}`);
        currentFolder = folderData.folder;
        breadcrumbs = await buildBreadcrumbs(folderData.folder);
      } else {
        currentFolder = null;
        breadcrumbs = [];
      }

      currentFolderId = folderId;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Ошибка загрузки';
    } finally {
      loading = false;
    }
  }

  // Build breadcrumbs path
  async function buildBreadcrumbs(folder: MediaFolder): Promise<MediaFolder[]> {
    const crumbs: MediaFolder[] = [folder];
    let current = folder;

    while (current.parent) {
      try {
        const parentData = await apiFetch<{ folder: MediaFolder }>(`/api/admin/media/folders/${current.parent.id}`);
        crumbs.unshift(parentData.folder);
        current = parentData.folder;
      } catch {
        break;
      }
    }

    return crumbs;
  }

  // Navigate to folder
  function navigateToFolder(folderId: number | null) {
    loadFolder(folderId);
  }

  // Create folder
  async function createFolder() {
    if (!newFolderName.trim()) return;

    creatingFolder = true;
    try {
      const slug = newFolderSlug.trim() || newFolderName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      await apiFetch('/api/admin/media/folders', {
        method: 'POST',
        body: JSON.stringify({
          name: newFolderName,
          slug,
          parentId: currentFolderId,
        }),
      });

      showNotification('success', 'Папка создана');
      showCreateFolder = false;
      newFolderName = '';
      newFolderSlug = '';
      await loadFolder(currentFolderId);
      await loadFolderTree();
    } catch (e) {
      showNotification('error', e instanceof Error ? e.message : 'Ошибка создания папки');
    } finally {
      creatingFolder = false;
    }
  }

  // Delete folder
  async function deleteFolder(folder: MediaFolder) {
    if (!confirm(`Удалить папку "${folder.name}"? Файлы будут перемещены в корень.`)) return;

    try {
      await apiFetch(`/api/admin/media/folders/${folder.id}?force=true`, {
        method: 'DELETE',
      });

      showNotification('success', 'Папка удалена');
      await loadFolder(currentFolderId);
      await loadFolderTree();
    } catch (e) {
      showNotification('error', e instanceof Error ? e.message : 'Ошибка удаления папки');
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
        if (currentFolderId) {
          formData.append('folderId', String(currentFolderId));
        }

        await apiFetch('/api/admin/media/upload', {
          method: 'POST',
          body: formData,
        });

        uploadProgress = ((i + 1) / fileList.length) * 100;
      }

      await loadFolder(currentFolderId);
      showUpload = false;
      showNotification('success', `Загружено файлов: ${fileList.length}`);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Ошибка загрузки';
      showNotification('error', 'Не удалось загрузить файлы');
    } finally {
      uploading = false;
      uploadProgress = 0;
      input.value = '';
    }
  }

  // Move file to folder
  async function moveFile(file: MediaFile, targetFolderId: number | null) {
    try {
      await apiFetch(`/api/admin/media/folders/move/${file.id}`, {
        method: 'PUT',
        body: JSON.stringify({ folderId: targetFolderId }),
      });

      showNotification('success', 'Файл перемещён');
      await loadFolder(currentFolderId);
    } catch (e) {
      showNotification('error', e instanceof Error ? e.message : 'Ошибка перемещения');
    }
  }

  // Delete file
  async function deleteFile(file: MediaFile) {
    if (!confirm(`Удалить файл "${file.originalName || file.filename}"?`)) return;

    try {
      await apiFetch(`/api/admin/media/${file.id}`, {
        method: 'DELETE',
      });

      files = files.filter(f => f.id !== file.id);

      if (selectedFile?.id === file.id) {
        selectedFile = null;
      }

      showNotification('success', 'Файл удален');
    } catch (e) {
      error = e instanceof Error ? e.message : 'Ошибка удаления';
      showNotification('error', 'Не удалось удалить файл');
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
    showNotification('success', 'URL скопирован');
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
    loadFolder(null);
    loadFolderTree();
  });
</script>

<div class="media-gallery" class:with-sidebar={showFolderSidebar}>
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

  <!-- Folder Sidebar -->
  {#if showFolderSidebar}
    <aside class="folder-sidebar">
      <div class="sidebar-header">
        <h3>📁 Папки</h3>
        <button type="button" class="btn-icon" onclick={() => showFolderSidebar = false} title="Скрыть">
          ◀
        </button>
      </div>

      <div class="folder-tree">
        <button
          type="button"
          class="folder-item"
          class:active={currentFolderId === null}
          onclick={() => navigateToFolder(null)}
        >
          🏠 Все файлы
        </button>

        {#each folderTree as folder (folder.id)}
          <button
            type="button"
            class="folder-item"
            class:active={currentFolderId === folder.id}
            onclick={() => navigateToFolder(folder.id)}
          >
            📁 {folder.name}
            {#if folder._count?.media}
              <span class="folder-count">{folder._count.media}</span>
            {/if}
          </button>
          {#if folder.children?.length}
            {#each folder.children as child (child.id)}
              <button
                type="button"
                class="folder-item folder-child"
                class:active={currentFolderId === child.id}
                onclick={() => navigateToFolder(child.id)}
              >
                📁 {child.name}
                {#if child._count?.media}
                  <span class="folder-count">{child._count.media}</span>
                {/if}
              </button>
            {/each}
          {/if}
        {/each}
      </div>

      <button type="button" class="btn btn-sm btn-outline sidebar-create" onclick={() => showCreateFolder = true}>
        ➕ Новая папка
      </button>
    </aside>
  {/if}

  <!-- Main Content -->
  <div class="main-content">
    <!-- Toolbar -->
    <div class="toolbar">
      <div class="toolbar-left">
        {#if !showFolderSidebar}
          <button type="button" class="btn-icon" onclick={() => showFolderSidebar = true} title="Показать папки">
            📁
          </button>
        {/if}

        <!-- Breadcrumbs -->
        <nav class="breadcrumbs">
          <button type="button" class="breadcrumb" onclick={() => navigateToFolder(null)}>
            🏠
          </button>
          {#each breadcrumbs as crumb, i (crumb.id)}
            <span class="breadcrumb-sep">/</span>
            <button
              type="button"
              class="breadcrumb"
              class:current={i === breadcrumbs.length - 1}
              onclick={() => navigateToFolder(crumb.id)}
            >
              {crumb.name}
            </button>
          {/each}
        </nav>

        <select bind:value={typeFilter} class="filter-select">
          <option value="all">Все типы</option>
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

      <div class="toolbar-right">
        <button type="button" onclick={() => showCreateFolder = true} class="btn btn-outline">
          📁 Папка
        </button>
        <button type="button" onclick={() => showUpload = true} class="btn btn-primary">
          📤 Загрузить
        </button>
      </div>
    </div>

    <!-- Error -->
    {#if error}
      <div class="message error">{error}</div>
    {/if}

    <!-- Content -->
    {#if loading}
      <div class="loading">
        <div class="spinner"></div>
        <span>Загрузка...</span>
      </div>
    {:else}
      <!-- Subfolders -->
      {#if folders.length > 0}
        <div class="subfolders">
          {#each folders as folder (folder.id)}
            <div class="subfolder-card">
              <button type="button" class="subfolder-main" onclick={() => navigateToFolder(folder.id)}>
                <span class="subfolder-icon">📁</span>
                <span class="subfolder-name">{folder.name}</span>
                <span class="subfolder-count">
                  {folder.mediaCount ?? folder._count?.media ?? 0} файлов
                </span>
              </button>
              <button
                type="button"
                class="subfolder-delete"
                onclick={() => deleteFolder(folder)}
                title="Удалить папку"
              >
                🗑️
              </button>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Files -->
      {#if filteredFiles.length === 0 && folders.length === 0}
        <div class="empty-state">
          <div class="empty-icon">📂</div>
          <h3>Папка пуста</h3>
          <p>Загрузите файлы или создайте подпапку</p>
          <div class="empty-actions">
            <button type="button" onclick={() => showUpload = true} class="btn btn-primary">
              Загрузить файлы
            </button>
            <button type="button" onclick={() => showCreateFolder = true} class="btn btn-outline">
              Создать папку
            </button>
          </div>
        </div>
      {:else if filteredFiles.length > 0}
        <!-- Grid View -->
        {#if viewMode === 'grid'}
          <div class="files-grid">
            {#each filteredFiles as file (file.id)}
              <div
                class="file-card"
                class:selected={selectedFile?.id === file.id}
                onclick={() => selectFile(file)}
                draggable="true"
                ondragstart={(e) => e.dataTransfer?.setData('fileId', String(file.id))}
              >
                <div class="file-preview">
                  {#if file.type === 'image'}
                    <img src={file.url} alt={file.originalName || file.filename} loading="lazy" />
                  {:else if file.type === 'video'}
                    <video src={file.url} preload="metadata"></video>
                    <span class="file-badge">🎬</span>
                  {:else}
                    <span class="file-icon">{getFileIcon(file)}</span>
                  {/if}
                </div>
                <div class="file-info">
                  <span class="file-name" title={file.originalName || file.filename}>
                    {file.originalName || file.filename}
                  </span>
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
                {#each filteredFiles as file (file.id)}
                  <tr
                    class:selected={selectedFile?.id === file.id}
                    onclick={() => selectFile(file)}
                  >
                    <td class="file-cell">
                      <span class="file-icon-small">{getFileIcon(file)}</span>
                      <span class="file-name-text">{file.originalName || file.filename}</span>
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
    {/if}
  </div>

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
          {#if currentFolder}
            <p class="upload-folder">📁 В папку: <strong>{currentFolder.name}</strong></p>
          {/if}
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

  <!-- Create Folder Modal -->
  {#if showCreateFolder}
    <div class="modal-overlay" onclick={() => !creatingFolder && (showCreateFolder = false)}>
      <div class="modal modal-sm" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>Новая папка</h2>
          {#if !creatingFolder}
            <button type="button" onclick={() => showCreateFolder = false} class="modal-close">✕</button>
          {/if}
        </div>
        <div class="modal-body">
          {#if currentFolder}
            <p class="create-folder-parent">📁 В папке: <strong>{currentFolder.name}</strong></p>
          {/if}
          <div class="form-group">
            <label for="folder-name">Название</label>
            <input
              type="text"
              id="folder-name"
              bind:value={newFolderName}
              placeholder="Например: Баннеры"
              disabled={creatingFolder}
            />
          </div>
          <div class="form-group">
            <label for="folder-slug">Slug (опционально)</label>
            <input
              type="text"
              id="folder-slug"
              bind:value={newFolderSlug}
              placeholder="banners"
              disabled={creatingFolder}
            />
            <small>Только латиница, цифры и дефисы</small>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" onclick={() => showCreateFolder = false} class="btn btn-outline" disabled={creatingFolder}>
            Отмена
          </button>
          <button type="button" onclick={createFolder} class="btn btn-primary" disabled={creatingFolder || !newFolderName.trim()}>
            {creatingFolder ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .media-gallery {
    display: flex;
    gap: var(--spacing-4);
    min-height: 500px;
  }

  .media-gallery.with-sidebar {
    /* Layout with sidebar */
  }

  /* Folder Sidebar */
  .folder-sidebar {
    width: 240px;
    flex-shrink: 0;
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    display: flex;
    flex-direction: column;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-4);
    border-bottom: 1px solid var(--color-border);
  }

  .sidebar-header h3 {
    margin: 0;
    font-size: var(--font-font-size-sm);
  }

  .folder-tree {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-2);
  }

  .folder-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-2) var(--spacing-3);
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
    border-radius: var(--radius-md);
    font-size: var(--font-font-size-sm);
    transition: background var(--transition-fast);
  }

  .folder-item:hover {
    background: var(--color-background-secondary);
  }

  .folder-item.active {
    background: var(--color-primary-light);
    font-weight: var(--font-font-weight-medium);
  }

  .folder-item.folder-child {
    padding-left: var(--spacing-6);
  }

  .folder-count {
    margin-left: auto;
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
    background: var(--color-background-secondary);
    padding: 0 var(--spacing-2);
    border-radius: var(--radius-full);
  }

  .sidebar-create {
    margin: var(--spacing-3);
  }

  /* Main Content */
  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
    min-width: 0;
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
    gap: var(--spacing-3);
    flex-wrap: wrap;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
  }

  /* Breadcrumbs */
  .breadcrumbs {
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
    font-size: var(--font-font-size-sm);
  }

  .breadcrumb {
    padding: var(--spacing-1) var(--spacing-2);
    border: none;
    background: none;
    cursor: pointer;
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
  }

  .breadcrumb:hover {
    background: var(--color-background-secondary);
    color: var(--color-text);
  }

  .breadcrumb.current {
    color: var(--color-text);
    font-weight: var(--font-font-weight-medium);
  }

  .breadcrumb-sep {
    color: var(--color-text-muted);
  }

  .filter-select {
    padding: var(--spacing-2) var(--spacing-3);
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
    font-size: 1rem;
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
    padding: var(--spacing-2) var(--spacing-4);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-medium);
    text-decoration: none;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-sm {
    padding: var(--spacing-2) var(--spacing-3);
    font-size: var(--font-font-size-xs);
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  .btn-outline {
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text);
  }

  .btn-outline:hover:not(:disabled) {
    background: var(--color-background-secondary);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--color-border);
    background: var(--color-background);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: 1rem;
  }

  .btn-icon:hover {
    background: var(--color-background-secondary);
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

  /* Subfolders */
  .subfolders {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--spacing-3);
    margin-bottom: var(--spacing-4);
  }

  .subfolder-card {
    display: flex;
    align-items: stretch;
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: border-color var(--transition-fast);
  }

  .subfolder-card:hover {
    border-color: var(--color-primary);
  }

  .subfolder-main {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-3) var(--spacing-4);
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
  }

  .subfolder-icon {
    font-size: 1.5rem;
  }

  .subfolder-name {
    font-weight: var(--font-font-weight-medium);
    font-size: var(--font-font-size-sm);
  }

  .subfolder-count {
    margin-left: auto;
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
  }

  .subfolder-delete {
    padding: var(--spacing-2);
    border: none;
    background: none;
    cursor: pointer;
    opacity: 0;
    transition: opacity var(--transition-fast);
  }

  .subfolder-card:hover .subfolder-delete {
    opacity: 1;
  }

  .subfolder-delete:hover {
    background: var(--color-error-light);
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

  .empty-actions {
    display: flex;
    gap: var(--spacing-3);
  }

  /* Grid View */
  .files-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
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

  .files-list tbody tr:hover {
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

  .modal-sm {
    max-width: 400px;
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

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-3);
    padding: var(--spacing-4) var(--spacing-6);
    border-top: 1px solid var(--color-border);
  }

  .upload-folder,
  .create-folder-parent {
    margin: 0 0 var(--spacing-4);
    padding: var(--spacing-3);
    background: var(--color-background-secondary);
    border-radius: var(--radius-md);
    font-size: var(--font-font-size-sm);
  }

  /* Form */
  .form-group {
    margin-bottom: var(--spacing-4);
  }

  .form-group label {
    display: block;
    margin-bottom: var(--spacing-2);
    font-size: var(--font-font-size-sm);
    font-weight: var(--font-font-weight-medium);
  }

  .form-group input {
    width: 100%;
    padding: var(--spacing-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-font-size-sm);
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-light);
  }

  .form-group small {
    display: block;
    margin-top: var(--spacing-1);
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
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

  /* Notification */
  .notification {
    position: fixed;
    top: var(--spacing-4);
    right: var(--spacing-4);
    z-index: 1100;
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
    transition: background var(--transition-fast);
  }

  .notification-close:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .media-gallery {
      flex-direction: column;
    }

    .folder-sidebar {
      width: 100%;
      max-height: 200px;
    }

    .files-grid {
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    }
  }
</style>
