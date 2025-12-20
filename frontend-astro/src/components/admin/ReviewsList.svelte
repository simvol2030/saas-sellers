<script lang="ts">
  import { apiFetch } from '../../lib/api';

  interface Review {
    id: number;
    productId: number;
    authorName: string;
    authorEmail: string;
    rating: number;
    title: string | null;
    content: string;
    status: string;
    isVerified: boolean;
    createdAt: string;
    updatedAt: string;
    product: {
      id: number;
      name: string;
      slug: string;
    };
  }

  interface ReviewsResponse {
    reviews: Review[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    pendingCount: number;
  }

  // State
  let reviews: Review[] = [];
  let page = 1;
  let totalPages = 1;
  let total = 0;
  let pendingCount = 0;
  let loading = true;
  let error = '';

  // Filters
  let statusFilter = 'pending';
  let searchQuery = '';

  // Selection
  let selectedIds: Set<number> = new Set();
  let selectAll = false;

  // Load reviews
  async function loadReviews() {
    loading = true;
    error = '';

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      });

      if (statusFilter) params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);

      const response = await apiFetch<ReviewsResponse>(
        `/api/admin/reviews/admin?${params.toString()}`
      );

      reviews = response.reviews;
      totalPages = response.pagination.totalPages;
      total = response.pagination.total;
      pendingCount = response.pendingCount;
      selectedIds = new Set();
      selectAll = false;
    } catch (err) {
      error = 'Failed to load reviews';
      console.error(err);
    } finally {
      loading = false;
    }
  }

  // Update review status
  async function updateStatus(id: number, status: string) {
    try {
      await apiFetch(`/api/admin/reviews/admin/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });

      // Reload to get updated data
      await loadReviews();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }

  // Toggle verified
  async function toggleVerified(id: number) {
    try {
      await apiFetch(`/api/admin/reviews/admin/${id}/verify`, {
        method: 'PATCH',
      });

      // Update local state
      reviews = reviews.map(r =>
        r.id === id ? { ...r, isVerified: !r.isVerified } : r
      );
    } catch (err) {
      console.error('Failed to toggle verified:', err);
    }
  }

  // Delete review
  async function deleteReview(id: number) {
    if (!confirm('Удалить этот отзыв?')) return;

    try {
      await apiFetch(`/api/admin/reviews/admin/${id}`, {
        method: 'DELETE',
      });

      await loadReviews();
    } catch (err) {
      console.error('Failed to delete review:', err);
    }
  }

  // Bulk action
  async function bulkAction(action: string) {
    if (selectedIds.size === 0) return;

    const actionLabels: Record<string, string> = {
      approve: 'одобрить',
      reject: 'отклонить',
      delete: 'удалить',
    };

    if (!confirm(`${actionLabels[action]} ${selectedIds.size} отзывов?`)) return;

    try {
      await apiFetch('/api/admin/reviews/admin/bulk', {
        method: 'POST',
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          action,
        }),
      });

      await loadReviews();
    } catch (err) {
      console.error('Bulk action failed:', err);
    }
  }

  // Toggle selection
  function toggleSelection(id: number) {
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }
    selectedIds = selectedIds;
    selectAll = selectedIds.size === reviews.length;
  }

  // Toggle all
  function toggleAll() {
    if (selectAll) {
      selectedIds = new Set();
    } else {
      selectedIds = new Set(reviews.map(r => r.id));
    }
    selectAll = !selectAll;
    selectedIds = selectedIds;
  }

  // Format date
  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Render stars
  function renderStars(rating: number): string {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  // Status label
  function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'На модерации',
      approved: 'Одобрен',
      rejected: 'Отклонён',
    };
    return labels[status] || status;
  }

  // Status class
  function getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      pending: 'status-pending',
      approved: 'status-approved',
      rejected: 'status-rejected',
    };
    return classes[status] || '';
  }

  // Handle search
  function handleSearch() {
    page = 1;
    loadReviews();
  }

  // Change filter
  function changeFilter(newStatus: string) {
    statusFilter = newStatus;
    page = 1;
    loadReviews();
  }

  // Change page
  function changePage(newPage: number) {
    if (newPage >= 1 && newPage <= totalPages) {
      page = newPage;
      loadReviews();
    }
  }

  // Load on mount
  loadReviews();
</script>

<div class="reviews-admin">
  <div class="header">
    <h1>Модерация отзывов</h1>
    {#if pendingCount > 0}
      <span class="pending-badge">{pendingCount} ожидает</span>
    {/if}
  </div>

  <!-- Filters -->
  <div class="filters">
    <div class="filter-tabs">
      <button
        class="filter-tab"
        class:active={statusFilter === ''}
        on:click={() => changeFilter('')}
      >
        Все
      </button>
      <button
        class="filter-tab"
        class:active={statusFilter === 'pending'}
        on:click={() => changeFilter('pending')}
      >
        На модерации
        {#if pendingCount > 0}
          <span class="badge">{pendingCount}</span>
        {/if}
      </button>
      <button
        class="filter-tab"
        class:active={statusFilter === 'approved'}
        on:click={() => changeFilter('approved')}
      >
        Одобренные
      </button>
      <button
        class="filter-tab"
        class:active={statusFilter === 'rejected'}
        on:click={() => changeFilter('rejected')}
      >
        Отклонённые
      </button>
    </div>

    <div class="search-box">
      <input
        type="text"
        placeholder="Поиск по автору, email, тексту..."
        bind:value={searchQuery}
        on:keyup={(e) => e.key === 'Enter' && handleSearch()}
      />
      <button on:click={handleSearch}>Найти</button>
    </div>
  </div>

  <!-- Bulk actions -->
  {#if selectedIds.size > 0}
    <div class="bulk-actions">
      <span>{selectedIds.size} выбрано</span>
      <button class="btn btn-success" on:click={() => bulkAction('approve')}>
        ✓ Одобрить
      </button>
      <button class="btn btn-warning" on:click={() => bulkAction('reject')}>
        ✗ Отклонить
      </button>
      <button class="btn btn-danger" on:click={() => bulkAction('delete')}>
        🗑 Удалить
      </button>
    </div>
  {/if}

  {#if loading}
    <div class="loading">Загрузка отзывов...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if reviews.length === 0}
    <div class="empty">
      <p>Отзывов не найдено</p>
    </div>
  {:else}
    <div class="reviews-table">
      <table>
        <thead>
          <tr>
            <th class="col-checkbox">
              <input
                type="checkbox"
                checked={selectAll}
                on:change={toggleAll}
              />
            </th>
            <th class="col-rating">Оценка</th>
            <th class="col-author">Автор</th>
            <th class="col-product">Товар</th>
            <th class="col-content">Отзыв</th>
            <th class="col-status">Статус</th>
            <th class="col-date">Дата</th>
            <th class="col-actions">Действия</th>
          </tr>
        </thead>
        <tbody>
          {#each reviews as review}
            <tr class:selected={selectedIds.has(review.id)}>
              <td class="col-checkbox">
                <input
                  type="checkbox"
                  checked={selectedIds.has(review.id)}
                  on:change={() => toggleSelection(review.id)}
                />
              </td>
              <td class="col-rating">
                <span class="stars">{renderStars(review.rating)}</span>
              </td>
              <td class="col-author">
                <div class="author-info">
                  <span class="author-name">{review.authorName}</span>
                  <span class="author-email">{review.authorEmail}</span>
                </div>
              </td>
              <td class="col-product">
                <a href="/admin/products/{review.product.id}" target="_blank">
                  {review.product.name}
                </a>
              </td>
              <td class="col-content">
                {#if review.title}
                  <strong>{review.title}</strong>
                  <br />
                {/if}
                <span class="content-preview">{review.content.slice(0, 150)}{review.content.length > 150 ? '...' : ''}</span>
              </td>
              <td class="col-status">
                <span class="status-badge {getStatusClass(review.status)}">
                  {getStatusLabel(review.status)}
                </span>
                {#if review.isVerified}
                  <span class="verified-badge" title="Подтверждённая покупка">✓</span>
                {/if}
              </td>
              <td class="col-date">
                {formatDate(review.createdAt)}
              </td>
              <td class="col-actions">
                <div class="actions">
                  {#if review.status !== 'approved'}
                    <button
                      class="btn-icon btn-success"
                      title="Одобрить"
                      on:click={() => updateStatus(review.id, 'approved')}
                    >
                      ✓
                    </button>
                  {/if}
                  {#if review.status !== 'rejected'}
                    <button
                      class="btn-icon btn-warning"
                      title="Отклонить"
                      on:click={() => updateStatus(review.id, 'rejected')}
                    >
                      ✗
                    </button>
                  {/if}
                  <button
                    class="btn-icon"
                    class:btn-verified={review.isVerified}
                    title={review.isVerified ? 'Снять метку подтверждения' : 'Отметить как подтверждённую покупку'}
                    on:click={() => toggleVerified(review.id)}
                  >
                    ✓✓
                  </button>
                  <button
                    class="btn-icon btn-danger"
                    title="Удалить"
                    on:click={() => deleteReview(review.id)}
                  >
                    🗑
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="pagination">
        <button
          class="page-btn"
          disabled={page <= 1}
          on:click={() => changePage(page - 1)}
        >
          ← Назад
        </button>

        <div class="page-numbers">
          {#each Array(totalPages).fill(0).map((_, i) => i + 1).filter(p =>
            p === 1 || p === totalPages || (p >= page - 2 && p <= page + 2)
          ) as pageNum, idx}
            {#if idx > 0}
              {@const prev = Array(totalPages).fill(0).map((_, i) => i + 1).filter(p =>
                p === 1 || p === totalPages || (p >= page - 2 && p <= page + 2)
              )[idx - 1]}
              {#if pageNum - prev > 1}
                <span class="ellipsis">...</span>
              {/if}
            {/if}
            <button
              class="page-num"
              class:active={page === pageNum}
              on:click={() => changePage(pageNum)}
            >
              {pageNum}
            </button>
          {/each}
        </div>

        <button
          class="page-btn"
          disabled={page >= totalPages}
          on:click={() => changePage(page + 1)}
        >
          Далее →
        </button>

        <span class="page-info">Всего: {total}</span>
      </div>
    {/if}
  {/if}
</div>

<style>
  .reviews-admin {
    padding: 1.5rem;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .header h1 {
    margin: 0;
  }

  .pending-badge {
    background: #ffc107;
    color: #333;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.9rem;
    font-weight: 600;
  }

  /* Filters */
  .filters {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .filter-tabs {
    display: flex;
    gap: 0.5rem;
  }

  .filter-tab {
    padding: 0.5rem 1rem;
    border: 1px solid #ddd;
    background: white;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .filter-tab.active {
    background: var(--color-primary, #007bff);
    color: white;
    border-color: var(--color-primary, #007bff);
  }

  .filter-tab .badge {
    background: #dc3545;
    color: white;
    padding: 0.1rem 0.4rem;
    border-radius: 10px;
    font-size: 0.75rem;
  }

  .search-box {
    display: flex;
    gap: 0.5rem;
  }

  .search-box input {
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    width: 250px;
  }

  .search-box button {
    padding: 0.5rem 1rem;
    background: var(--color-primary, #007bff);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  /* Bulk actions */
  .bulk-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: #f0f0f0;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  .bulk-actions .btn {
    padding: 0.4rem 0.75rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .btn-success {
    background: #28a745;
    color: white;
  }

  .btn-warning {
    background: #ffc107;
    color: #333;
  }

  .btn-danger {
    background: #dc3545;
    color: white;
  }

  /* Table */
  .reviews-table {
    overflow-x: auto;
    background: white;
    border-radius: 8px;
    border: 1px solid #ddd;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th, td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid #eee;
  }

  th {
    background: #f8f9fa;
    font-weight: 600;
    white-space: nowrap;
  }

  tr:hover {
    background: #f8f9fa;
  }

  tr.selected {
    background: #e3f2fd;
  }

  .col-checkbox {
    width: 40px;
  }

  .col-rating {
    width: 100px;
  }

  .col-author {
    width: 150px;
  }

  .col-product {
    width: 150px;
  }

  .col-status {
    width: 120px;
  }

  .col-date {
    width: 120px;
    white-space: nowrap;
  }

  .col-actions {
    width: 120px;
  }

  .stars {
    color: #ffc107;
    font-size: 1.1rem;
  }

  .author-info {
    display: flex;
    flex-direction: column;
  }

  .author-name {
    font-weight: 500;
  }

  .author-email {
    font-size: 0.85rem;
    color: #666;
  }

  .col-product a {
    color: var(--color-primary, #007bff);
    text-decoration: none;
  }

  .col-product a:hover {
    text-decoration: underline;
  }

  .content-preview {
    font-size: 0.9rem;
    color: #555;
    line-height: 1.4;
  }

  .status-badge {
    display: inline-block;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.85rem;
  }

  .status-pending {
    background: #fff3cd;
    color: #856404;
  }

  .status-approved {
    background: #d4edda;
    color: #155724;
  }

  .status-rejected {
    background: #f8d7da;
    color: #721c24;
  }

  .verified-badge {
    display: inline-block;
    background: #28a745;
    color: white;
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    font-size: 0.7rem;
    margin-left: 0.25rem;
  }

  .actions {
    display: flex;
    gap: 0.25rem;
  }

  .btn-icon {
    padding: 0.3rem 0.5rem;
    border: 1px solid #ddd;
    background: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .btn-icon.btn-success {
    background: #d4edda;
    border-color: #c3e6cb;
  }

  .btn-icon.btn-warning {
    background: #fff3cd;
    border-color: #ffeeba;
  }

  .btn-icon.btn-danger {
    background: #f8d7da;
    border-color: #f5c6cb;
  }

  .btn-icon.btn-verified {
    background: #d4edda;
    border-color: #28a745;
    color: #28a745;
  }

  /* Pagination */
  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1.5rem;
    flex-wrap: wrap;
  }

  .page-btn {
    padding: 0.5rem 1rem;
    border: 1px solid #ddd;
    background: white;
    border-radius: 4px;
    cursor: pointer;
  }

  .page-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .page-numbers {
    display: flex;
    gap: 0.25rem;
  }

  .page-num {
    padding: 0.4rem 0.7rem;
    border: 1px solid #ddd;
    background: white;
    border-radius: 4px;
    cursor: pointer;
  }

  .page-num.active {
    background: var(--color-primary, #007bff);
    color: white;
    border-color: var(--color-primary, #007bff);
  }

  .ellipsis {
    padding: 0.4rem;
  }

  .page-info {
    margin-left: 1rem;
    color: #666;
  }

  .loading, .error, .empty {
    text-align: center;
    padding: 3rem;
  }

  .error {
    color: #dc3545;
  }

  .empty {
    color: #666;
  }
</style>
