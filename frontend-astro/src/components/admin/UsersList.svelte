<script lang="ts">
  /**
   * Users List Component - Phase 3
   *
   * User management for superadmins:
   * - List all users with their status
   * - Create/Edit/Delete users
   * - Manage site access and permissions
   */

  import { onMount } from 'svelte';
  import { apiFetch } from '../../lib/api';

  interface User {
    id: number;
    email: string;
    name: string | null;
    role: 'admin' | 'editor' | 'viewer';
    isSuperadmin: boolean;
    isActive: boolean;
    createdAt: string;
    _count: {
      ownedSites: number;
      userSites: number;
    };
  }

  interface UserDetail extends User {
    ownedSites: Array<{ id: number; name: string; slug: string }>;
    userSites: Array<{
      id: number;
      permissions: string;
      site: { id: number; name: string; slug: string };
    }>;
  }

  interface Site {
    id: number;
    name: string;
    slug: string;
  }

  interface Section {
    key: string;
    label: string;
    icon: string;
  }

  // State
  let users: User[] = $state([]);
  let sections: Record<string, Section> = $state({});
  let allSites: Site[] = $state([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let notification = $state<{ type: 'success' | 'error'; message: string } | null>(null);
  let currentUser = $state<{ id: number; isSuperadmin: boolean } | null>(null);

  // Modals
  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showSitesModal = $state(false);
  let editingUser = $state<UserDetail | null>(null);
  let selectedUser = $state<UserDetail | null>(null);

  // Forms
  let newUser = $state({
    email: '',
    password: '',
    name: '',
    role: 'editor' as 'admin' | 'editor' | 'viewer',
    isSuperadmin: false,
  });

  let editForm = $state({
    email: '',
    name: '',
    password: '',
    role: 'editor' as 'admin' | 'editor' | 'viewer',
    isActive: true,
    isSuperadmin: false,
  });

  // Site assignment
  let selectedSiteId = $state<number | null>(null);
  let sitePermissions = $state<Record<string, boolean>>({});

  function showNotification(type: 'success' | 'error', message: string) {
    notification = { type, message };
    setTimeout(() => notification = null, 5000);
  }

  async function loadUsers() {
    loading = true;
    error = null;

    try {
      const [usersData, sectionsData, sitesData, meData] = await Promise.all([
        apiFetch<{ users: User[] }>('/api/admin/users'),
        apiFetch<{ sections: Record<string, Section> }>('/api/admin/users/sections'),
        apiFetch<{ sites: Site[] }>('/api/admin/sites'),
        apiFetch<{ user: { id: number; isSuperadmin: boolean } }>('/api/auth/me'),
      ]);

      users = usersData.users;
      sections = sectionsData.sections;
      allSites = sitesData.sites;
      currentUser = meData.user;
    } catch (e: any) {
      if (e.message?.includes('Superadmin access required') || e.data?.code === 'SUPERADMIN_REQUIRED') {
        error = 'Доступ только для суперадминистраторов';
      } else {
        error = e instanceof Error ? e.message : 'Ошибка загрузки пользователей';
      }
    } finally {
      loading = false;
    }
  }

  async function loadUserDetails(id: number): Promise<UserDetail | null> {
    try {
      const data = await apiFetch<{ user: UserDetail }>(`/api/admin/users/${id}`);
      return data.user;
    } catch (e) {
      showNotification('error', 'Ошибка загрузки данных пользователя');
      return null;
    }
  }

  async function createUser() {
    if (!newUser.email || !newUser.password) {
      showNotification('error', 'Email и пароль обязательны');
      return;
    }

    if (newUser.password.length < 8) {
      showNotification('error', 'Пароль должен быть минимум 8 символов');
      return;
    }

    try {
      await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
      });
      showNotification('success', 'Пользователь создан');
      showCreateModal = false;
      newUser = { email: '', password: '', name: '', role: 'editor', isSuperadmin: false };
      loadUsers();
    } catch (e: any) {
      showNotification('error', e.data?.error || e.message || 'Ошибка создания пользователя');
    }
  }

  async function openEditModal(user: User) {
    const details = await loadUserDetails(user.id);
    if (!details) return;

    editingUser = details;
    editForm = {
      email: details.email,
      name: details.name || '',
      password: '',
      role: details.role,
      isActive: details.isActive,
      isSuperadmin: details.isSuperadmin,
    };
    showEditModal = true;
  }

  async function updateUser() {
    if (!editingUser) return;

    const updateData: any = {};
    if (editForm.email !== editingUser.email) updateData.email = editForm.email;
    if (editForm.name !== (editingUser.name || '')) updateData.name = editForm.name || null;
    if (editForm.password) updateData.password = editForm.password;
    if (editForm.role !== editingUser.role) updateData.role = editForm.role;
    if (editForm.isActive !== editingUser.isActive) updateData.isActive = editForm.isActive;
    if (editForm.isSuperadmin !== editingUser.isSuperadmin) updateData.isSuperadmin = editForm.isSuperadmin;

    if (Object.keys(updateData).length === 0) {
      showNotification('error', 'Нет изменений');
      return;
    }

    try {
      await apiFetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      showNotification('success', 'Пользователь обновлён');
      showEditModal = false;
      editingUser = null;
      loadUsers();
    } catch (e: any) {
      showNotification('error', e.data?.error || e.message || 'Ошибка обновления');
    }
  }

  async function deleteUser(id: number, email: string) {
    if (!confirm(`Удалить пользователя "${email}"? Это действие необратимо.`)) return;

    try {
      await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      showNotification('success', 'Пользователь удалён');
      loadUsers();
    } catch (e: any) {
      showNotification('error', e.data?.error || e.message || 'Ошибка удаления');
    }
  }

  async function openSitesModal(user: User) {
    const details = await loadUserDetails(user.id);
    if (!details) return;

    selectedUser = details;
    selectedSiteId = null;
    sitePermissions = {
      pages: true,
      blocks: true,
      menus: true,
      media: true,
      settings: false,
    };
    showSitesModal = true;
  }

  async function assignSite() {
    if (!selectedUser || !selectedSiteId) {
      showNotification('error', 'Выберите сайт');
      return;
    }

    try {
      await apiFetch(`/api/admin/users/${selectedUser.id}/sites`, {
        method: 'POST',
        body: JSON.stringify({
          siteIds: [selectedSiteId],
          permissions: sitePermissions,
        }),
      });
      showNotification('success', 'Сайт назначен');

      // Reload user details
      const details = await loadUserDetails(selectedUser.id);
      if (details) selectedUser = details;
      selectedSiteId = null;
    } catch (e: any) {
      showNotification('error', e.data?.error || e.message || 'Ошибка назначения');
    }
  }

  async function removeSiteAccess(siteId: number) {
    if (!selectedUser) return;
    if (!confirm('Отозвать доступ к сайту?')) return;

    try {
      await apiFetch(`/api/admin/users/${selectedUser.id}/sites/${siteId}`, {
        method: 'DELETE',
      });
      showNotification('success', 'Доступ отозван');

      // Reload user details
      const details = await loadUserDetails(selectedUser.id);
      if (details) selectedUser = details;
    } catch (e: any) {
      showNotification('error', e.data?.error || e.message || 'Ошибка');
    }
  }

  async function updateSitePermissions(siteId: number, newPermissions: Record<string, boolean>) {
    if (!selectedUser) return;

    try {
      await apiFetch(`/api/admin/users/${selectedUser.id}/sites/${siteId}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: newPermissions }),
      });
      showNotification('success', 'Права обновлены');

      // Reload user details
      const details = await loadUserDetails(selectedUser.id);
      if (details) selectedUser = details;
    } catch (e: any) {
      showNotification('error', e.data?.error || e.message || 'Ошибка');
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      admin: 'Админ',
      editor: 'Редактор',
      viewer: 'Читатель',
    };
    return labels[role] || role;
  }

  // Get sites that user doesn't have access to yet
  function getAvailableSites(): Site[] {
    if (!selectedUser) return allSites;

    const assignedIds = new Set([
      ...selectedUser.ownedSites.map(s => s.id),
      ...selectedUser.userSites.map(us => us.site.id),
    ]);

    return allSites.filter(s => !assignedIds.has(s.id));
  }

  onMount(() => {
    loadUsers();
  });
</script>

<div class="users-list">
  {#if notification}
    <div class="notification notification-{notification.type}">
      {notification.message}
      <button type="button" class="notification-close" onclick={() => notification = null}>×</button>
    </div>
  {/if}

  <div class="toolbar">
    <h2 class="page-title">Управление пользователями</h2>
    <button type="button" class="btn btn-primary" onclick={() => showCreateModal = true}>
      ➕ Добавить пользователя
    </button>
  </div>

  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <span>Загрузка...</span>
    </div>
  {:else if error}
    <div class="error-message">
      <p>❌ {error}</p>
      {#if !error.includes('суперадмин')}
        <button onclick={loadUsers} class="btn btn-secondary">Повторить</button>
      {/if}
    </div>
  {:else if users.length === 0}
    <div class="empty-state">
      <div class="empty-icon">👥</div>
      <h3>Нет пользователей</h3>
      <p>Добавьте первого пользователя</p>
      <button type="button" class="btn btn-primary" onclick={() => showCreateModal = true}>
        Добавить пользователя
      </button>
    </div>
  {:else}
    <div class="users-table-container">
      <table class="users-table">
        <thead>
          <tr>
            <th>Пользователь</th>
            <th>Роль</th>
            <th>Статус</th>
            <th>Сайты</th>
            <th>Дата создания</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {#each users as user (user.id)}
            <tr class:inactive={!user.isActive}>
              <td>
                <div class="user-info">
                  <span class="user-avatar">{user.isSuperadmin ? '👑' : '👤'}</span>
                  <div>
                    <div class="user-name">{user.name || user.email}</div>
                    {#if user.name}
                      <div class="user-email">{user.email}</div>
                    {/if}
                  </div>
                </div>
              </td>
              <td>
                <span class="role-badge role-{user.role}">
                  {getRoleLabel(user.role)}
                </span>
                {#if user.isSuperadmin}
                  <span class="superadmin-badge">Super</span>
                {/if}
              </td>
              <td>
                <span class="status-badge status-{user.isActive ? 'active' : 'inactive'}">
                  {user.isActive ? 'Активен' : 'Отключён'}
                </span>
              </td>
              <td>
                <span class="sites-count">
                  {user._count.ownedSites} своих, {user._count.userSites} доступ
                </span>
              </td>
              <td class="date-cell">{formatDate(user.createdAt)}</td>
              <td>
                <div class="actions">
                  <button
                    type="button"
                    class="btn btn-sm btn-outline"
                    onclick={() => openSitesModal(user)}
                    title="Управление сайтами"
                  >
                    🌐
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-outline"
                    onclick={() => openEditModal(user)}
                    disabled={user.id === currentUser?.id}
                    title={user.id === currentUser?.id ? 'Нельзя редактировать себя' : 'Редактировать'}
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-danger"
                    onclick={() => deleteUser(user.id, user.email)}
                    disabled={user.id === currentUser?.id}
                    title={user.id === currentUser?.id ? 'Нельзя удалить себя' : 'Удалить'}
                  >
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <!-- Create User Modal -->
  {#if showCreateModal}
    <div class="modal-overlay" onclick={() => showCreateModal = false}>
      <div class="modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>Новый пользователь</h2>
          <button type="button" class="modal-close" onclick={() => showCreateModal = false}>✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="new-email">Email *</label>
            <input
              id="new-email"
              type="email"
              bind:value={newUser.email}
              placeholder="user@example.com"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="new-password">Пароль *</label>
            <input
              id="new-password"
              type="password"
              bind:value={newUser.password}
              placeholder="Минимум 8 символов"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="new-name">Имя</label>
            <input
              id="new-name"
              type="text"
              bind:value={newUser.name}
              placeholder="Иван Петров"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="new-role">Роль</label>
            <select id="new-role" bind:value={newUser.role} class="form-select">
              <option value="viewer">Читатель</option>
              <option value="editor">Редактор</option>
              <option value="admin">Админ</option>
            </select>
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={newUser.isSuperadmin} />
              <span>Суперадминистратор (полный доступ ко всем сайтам)</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick={() => showCreateModal = false}>
            Отмена
          </button>
          <button type="button" class="btn btn-primary" onclick={createUser}>
            Создать
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Edit User Modal -->
  {#if showEditModal && editingUser}
    <div class="modal-overlay" onclick={() => { showEditModal = false; editingUser = null; }}>
      <div class="modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>Редактировать пользователя</h2>
          <button type="button" class="modal-close" onclick={() => { showEditModal = false; editingUser = null; }}>✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="edit-email">Email</label>
            <input
              id="edit-email"
              type="email"
              bind:value={editForm.email}
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="edit-name">Имя</label>
            <input
              id="edit-name"
              type="text"
              bind:value={editForm.name}
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="edit-password">Новый пароль</label>
            <input
              id="edit-password"
              type="password"
              bind:value={editForm.password}
              placeholder="Оставьте пустым, чтобы не менять"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="edit-role">Роль</label>
            <select id="edit-role" bind:value={editForm.role} class="form-select">
              <option value="viewer">Читатель</option>
              <option value="editor">Редактор</option>
              <option value="admin">Админ</option>
            </select>
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={editForm.isActive} />
              <span>Активен (может входить в систему)</span>
            </label>
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={editForm.isSuperadmin} />
              <span>Суперадминистратор</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick={() => { showEditModal = false; editingUser = null; }}>
            Отмена
          </button>
          <button type="button" class="btn btn-primary" onclick={updateUser}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Sites Management Modal -->
  {#if showSitesModal && selectedUser}
    <div class="modal-overlay" onclick={() => { showSitesModal = false; selectedUser = null; }}>
      <div class="modal modal-lg" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>Доступ к сайтам: {selectedUser.name || selectedUser.email}</h2>
          <button type="button" class="modal-close" onclick={() => { showSitesModal = false; selectedUser = null; }}>✕</button>
        </div>
        <div class="modal-body">
          <!-- Owned Sites -->
          {#if selectedUser.ownedSites.length > 0}
            <div class="sites-section">
              <h3>Владелец сайтов</h3>
              <div class="sites-list">
                {#each selectedUser.ownedSites as site (site.id)}
                  <div class="site-item site-owned">
                    <span class="site-name">👑 {site.name}</span>
                    <span class="site-slug">/{site.slug}</span>
                    <span class="site-access">Полный доступ</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Assigned Sites -->
          {#if selectedUser.userSites.length > 0}
            <div class="sites-section">
              <h3>Доступ к сайтам</h3>
              <div class="sites-list">
                {#each selectedUser.userSites as userSite (userSite.id)}
                  {@const permissions = JSON.parse(userSite.permissions || '{}')}
                  <div class="site-item">
                    <div class="site-header">
                      <span class="site-name">🌐 {userSite.site.name}</span>
                      <button
                        type="button"
                        class="btn btn-sm btn-danger"
                        onclick={() => removeSiteAccess(userSite.site.id)}
                      >
                        Отозвать
                      </button>
                    </div>
                    <div class="permissions-grid">
                      {#each Object.entries(sections) as [key, section]}
                        <label class="permission-checkbox">
                          <input
                            type="checkbox"
                            checked={permissions[key] === true}
                            onchange={(e) => {
                              const newPerms = { ...permissions, [key]: (e.target as HTMLInputElement).checked };
                              updateSitePermissions(userSite.site.id, newPerms);
                            }}
                          />
                          <span>{section.label}</span>
                        </label>
                      {/each}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Add Site Access -->
          <div class="sites-section">
            <h3>Добавить доступ к сайту</h3>
            {#if getAvailableSites().length === 0}
              <p class="no-sites">Нет доступных сайтов для назначения</p>
            {:else}
              {@const availableSites = getAvailableSites()}
              <div class="add-site-form">
                <select bind:value={selectedSiteId} class="form-select">
                  <option value={null}>Выберите сайт...</option>
                  {#each availableSites as site (site.id)}
                    <option value={site.id}>{site.name} (/{site.slug})</option>
                  {/each}
                </select>
                {#if selectedSiteId}
                  <div class="permissions-grid">
                    {#each Object.entries(sections) as [key, section]}
                      <label class="permission-checkbox">
                        <input
                          type="checkbox"
                          bind:checked={sitePermissions[key]}
                        />
                        <span>{section.label}</span>
                      </label>
                    {/each}
                  </div>
                  <button type="button" class="btn btn-primary" onclick={assignSite}>
                    Назначить доступ
                  </button>
                {/if}
              </div>
            {/if}
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick={() => { showSitesModal = false; selectedUser = null; }}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .users-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-4);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .page-title {
    margin: 0;
    font-size: var(--font-font-size-xl);
    font-weight: var(--font-font-weight-semibold);
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

  .btn-outline {
    background: transparent;
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  .btn-outline:hover:not(:disabled) {
    background: var(--color-background-secondary);
  }

  .btn-danger {
    background: transparent;
    color: var(--color-error);
    border: 1px solid var(--color-error);
  }

  .btn-danger:hover:not(:disabled) {
    background: var(--color-error-light);
  }

  .btn-sm {
    padding: var(--spacing-2) var(--spacing-3);
    font-size: var(--font-font-size-xs);
  }

  /* Loading & Error */
  .loading,
  .error-message,
  .empty-state {
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
    margin-bottom: var(--spacing-4);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
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

  /* Table */
  .users-table-container {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .users-table {
    width: 100%;
    border-collapse: collapse;
  }

  .users-table th,
  .users-table td {
    padding: var(--spacing-3) var(--spacing-4);
    text-align: left;
    border-bottom: 1px solid var(--color-border);
  }

  .users-table th {
    background: var(--color-background-secondary);
    font-weight: var(--font-font-weight-semibold);
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
  }

  .users-table tr:last-child td {
    border-bottom: none;
  }

  .users-table tr.inactive {
    opacity: 0.6;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
  }

  .user-avatar {
    font-size: 1.5rem;
  }

  .user-name {
    font-weight: var(--font-font-weight-medium);
  }

  .user-email {
    font-size: var(--font-font-size-xs);
    color: var(--color-text-muted);
  }

  .role-badge {
    display: inline-block;
    padding: var(--spacing-1) var(--spacing-2);
    border-radius: var(--radius-sm);
    font-size: var(--font-font-size-xs);
    font-weight: var(--font-font-weight-medium);
  }

  .role-admin {
    background: var(--color-primary-light);
    color: var(--color-primary);
  }

  .role-editor {
    background: var(--color-success-light);
    color: var(--color-success);
  }

  .role-viewer {
    background: var(--color-warning-light);
    color: var(--color-warning);
  }

  .superadmin-badge {
    margin-left: var(--spacing-2);
    padding: var(--spacing-1) var(--spacing-2);
    background: gold;
    color: #333;
    border-radius: var(--radius-sm);
    font-size: var(--font-font-size-xs);
    font-weight: var(--font-font-weight-bold);
  }

  .status-badge {
    display: inline-block;
    padding: var(--spacing-1) var(--spacing-2);
    border-radius: var(--radius-sm);
    font-size: var(--font-font-size-xs);
  }

  .status-active {
    background: var(--color-success-light);
    color: var(--color-success);
  }

  .status-inactive {
    background: var(--color-error-light);
    color: var(--color-error);
  }

  .sites-count {
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
  }

  .date-cell {
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
  }

  .actions {
    display: flex;
    gap: var(--spacing-2);
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
    overflow-y: auto;
  }

  .modal {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-lg {
    max-width: 700px;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-4) var(--spacing-6);
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    background: var(--color-background);
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
    position: sticky;
    bottom: 0;
    background: var(--color-background);
  }

  /* Form */
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
  }

  .form-input,
  .form-select {
    width: 100%;
    padding: var(--spacing-3) var(--spacing-4);
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
    box-shadow: 0 0 0 3px var(--color-primary-light);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    cursor: pointer;
  }

  .checkbox-label input {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  /* Sites Section */
  .sites-section {
    margin-bottom: var(--spacing-6);
  }

  .sites-section:last-child {
    margin-bottom: 0;
  }

  .sites-section h3 {
    margin: 0 0 var(--spacing-3);
    font-size: var(--font-font-size-md);
    font-weight: var(--font-font-weight-semibold);
  }

  .sites-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .site-item {
    padding: var(--spacing-4);
    background: var(--color-background-secondary);
    border-radius: var(--radius-md);
  }

  .site-owned {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
  }

  .site-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-3);
  }

  .site-name {
    font-weight: var(--font-font-weight-medium);
  }

  .site-slug {
    font-size: var(--font-font-size-sm);
    color: var(--color-text-muted);
    font-family: monospace;
  }

  .site-access {
    margin-left: auto;
    font-size: var(--font-font-size-xs);
    color: var(--color-success);
  }

  .permissions-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-3);
  }

  .permission-checkbox {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    font-size: var(--font-font-size-sm);
    cursor: pointer;
  }

  .permission-checkbox input {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .add-site-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .no-sites {
    color: var(--color-text-muted);
    font-style: italic;
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
    box-shadow: var(--shadow-xl);
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
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
    width: 24px;
    height: 24px;
    border: none;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .users-table-container {
      overflow-x: auto;
    }

    .users-table {
      min-width: 700px;
    }

    .toolbar {
      flex-direction: column;
      gap: var(--spacing-3);
    }
  }
</style>
