<script lang="ts">
  import { apiFetch } from '../../lib/api';

  interface Review {
    id: number;
    authorName: string;
    rating: number;
    title: string | null;
    content: string;
    isVerified: boolean;
    createdAt: string;
  }

  interface ReviewStats {
    averageRating: number;
    totalReviews: number;
    distribution: {
      1: number;
      2: number;
      3: number;
      4: number;
      5: number;
    };
  }

  interface ReviewsResponse {
    reviews: Review[];
    stats: ReviewStats;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }

  // Props
  export let productId: number;
  export let productName: string = '';

  // State
  let reviews: Review[] = [];
  let stats: ReviewStats | null = null;
  let page = 1;
  let totalPages = 1;
  let loading = true;
  let error = '';

  // Form state
  let showForm = false;
  let formData = {
    authorName: '',
    authorEmail: '',
    rating: 5,
    title: '',
    content: '',
  };
  let submitting = false;
  let submitSuccess = false;
  let submitError = '';

  // Sort state
  let sortBy = 'createdAt';
  let sortOrder = 'desc';

  // Load reviews
  async function loadReviews() {
    loading = true;
    error = '';

    try {
      const response = await apiFetch<ReviewsResponse>(
        `/api/reviews/product/${productId}?page=${page}&limit=10&sortBy=${sortBy}&sortOrder=${sortOrder}`
      );

      reviews = response.reviews;
      stats = response.stats;
      totalPages = response.pagination.totalPages;
    } catch (err) {
      error = 'Failed to load reviews';
      console.error(err);
    } finally {
      loading = false;
    }
  }

  // Submit review
  async function submitReview() {
    if (submitting) return;

    submitError = '';
    submitting = true;

    try {
      await apiFetch('/api/reviews/submit', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          ...formData,
        }),
      });

      submitSuccess = true;
      showForm = false;
      formData = { authorName: '', authorEmail: '', rating: 5, title: '', content: '' };

    } catch (err: unknown) {
      const apiError = err as { message?: string };
      submitError = apiError.message || 'Failed to submit review';
    } finally {
      submitting = false;
    }
  }

  // Format date
  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  // Render stars
  function renderStars(rating: number): string {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  // Calculate percentage for distribution bar
  function getPercentage(count: number): number {
    if (!stats || stats.totalReviews === 0) return 0;
    return (count / stats.totalReviews) * 100;
  }

  // Change page
  function changePage(newPage: number) {
    if (newPage >= 1 && newPage <= totalPages) {
      page = newPage;
      loadReviews();
    }
  }

  // Change sort
  function changeSort(newSortBy: string) {
    if (sortBy === newSortBy) {
      sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    } else {
      sortBy = newSortBy;
      sortOrder = 'desc';
    }
    page = 1;
    loadReviews();
  }

  // Load on mount
  $: if (productId) {
    loadReviews();
  }
</script>

<div class="product-reviews">
  <div class="reviews-header">
    <h2>Отзывы о товаре</h2>
    <button class="btn btn-primary" on:click={() => showForm = !showForm}>
      {showForm ? 'Отмена' : 'Написать отзыв'}
    </button>
  </div>

  {#if submitSuccess}
    <div class="alert alert-success">
      Спасибо за ваш отзыв! Он будет опубликован после модерации.
    </div>
  {/if}

  {#if showForm}
    <form class="review-form" on:submit|preventDefault={submitReview}>
      <h3>Написать отзыв{productName ? ` о "${productName}"` : ''}</h3>

      {#if submitError}
        <div class="alert alert-error">{submitError}</div>
      {/if}

      <div class="form-row">
        <div class="form-group">
          <label for="authorName">Ваше имя *</label>
          <input
            type="text"
            id="authorName"
            bind:value={formData.authorName}
            required
            minlength="2"
            maxlength="100"
          />
        </div>
        <div class="form-group">
          <label for="authorEmail">Email *</label>
          <input
            type="email"
            id="authorEmail"
            bind:value={formData.authorEmail}
            required
          />
        </div>
      </div>

      <div class="form-group">
        <label>Оценка *</label>
        <div class="rating-input">
          {#each [1, 2, 3, 4, 5] as star}
            <button
              type="button"
              class="star-btn"
              class:active={formData.rating >= star}
              on:click={() => formData.rating = star}
            >
              ★
            </button>
          {/each}
        </div>
      </div>

      <div class="form-group">
        <label for="title">Заголовок (необязательно)</label>
        <input
          type="text"
          id="title"
          bind:value={formData.title}
          maxlength="200"
          placeholder="Кратко о вашем впечатлении"
        />
      </div>

      <div class="form-group">
        <label for="content">Текст отзыва *</label>
        <textarea
          id="content"
          bind:value={formData.content}
          required
          minlength="10"
          maxlength="5000"
          rows="5"
          placeholder="Расскажите подробнее о вашем опыте использования"
        ></textarea>
      </div>

      <button type="submit" class="btn btn-primary" disabled={submitting}>
        {submitting ? 'Отправка...' : 'Отправить отзыв'}
      </button>
    </form>
  {/if}

  {#if loading && reviews.length === 0}
    <div class="loading">Загрузка отзывов...</div>
  {:else if error}
    <div class="alert alert-error">{error}</div>
  {:else if stats}
    <!-- Stats Summary -->
    <div class="reviews-stats">
      <div class="stats-left">
        <div class="average-rating">
          <span class="rating-number">{stats.averageRating.toFixed(1)}</span>
          <span class="stars">{renderStars(Math.round(stats.averageRating))}</span>
        </div>
        <div class="total-reviews">
          {stats.totalReviews} {stats.totalReviews === 1 ? 'отзыв' : stats.totalReviews < 5 ? 'отзыва' : 'отзывов'}
        </div>
      </div>
      <div class="stats-right">
        {#each [5, 4, 3, 2, 1] as star}
          <div class="distribution-row">
            <span class="star-label">{star} ★</span>
            <div class="distribution-bar">
              <div
                class="distribution-fill"
                style="width: {getPercentage(stats.distribution[star as 1|2|3|4|5])}%"
              ></div>
            </div>
            <span class="count">{stats.distribution[star as 1|2|3|4|5]}</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Sort options -->
    {#if reviews.length > 0}
      <div class="sort-options">
        <span>Сортировка:</span>
        <button
          class="sort-btn"
          class:active={sortBy === 'createdAt'}
          on:click={() => changeSort('createdAt')}
        >
          По дате {sortBy === 'createdAt' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
        </button>
        <button
          class="sort-btn"
          class:active={sortBy === 'rating'}
          on:click={() => changeSort('rating')}
        >
          По оценке {sortBy === 'rating' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
        </button>
      </div>
    {/if}

    <!-- Reviews List -->
    {#if reviews.length === 0}
      <div class="no-reviews">
        <p>Отзывов пока нет. Будьте первым!</p>
      </div>
    {:else}
      <div class="reviews-list">
        {#each reviews as review}
          <div class="review-card">
            <div class="review-header">
              <div class="review-author">
                <span class="author-name">{review.authorName}</span>
                {#if review.isVerified}
                  <span class="verified-badge" title="Подтверждённая покупка">✓</span>
                {/if}
              </div>
              <div class="review-meta">
                <span class="review-rating">{renderStars(review.rating)}</span>
                <span class="review-date">{formatDate(review.createdAt)}</span>
              </div>
            </div>
            {#if review.title}
              <h4 class="review-title">{review.title}</h4>
            {/if}
            <p class="review-content">{review.content}</p>
          </div>
        {/each}
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
          <span class="page-info">Страница {page} из {totalPages}</span>
          <button
            class="page-btn"
            disabled={page >= totalPages}
            on:click={() => changePage(page + 1)}
          >
            Далее →
          </button>
        </div>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .product-reviews {
    margin: 2rem 0;
    padding: 1.5rem;
    background: var(--bg-secondary, #f9f9f9);
    border-radius: 8px;
  }

  .reviews-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .reviews-header h2 {
    margin: 0;
  }

  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
  }

  .btn-primary {
    background: var(--color-primary, #007bff);
    color: white;
  }

  .btn-primary:hover {
    background: var(--color-primary-dark, #0056b3);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .alert {
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  .alert-success {
    background: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  }

  .alert-error {
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }

  /* Review Form */
  .review-form {
    background: white;
    padding: 1.5rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
    border: 1px solid #ddd;
  }

  .review-form h3 {
    margin-top: 0;
    margin-bottom: 1rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  @media (max-width: 600px) {
    .form-row {
      grid-template-columns: 1fr;
    }
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
  }

  .form-group textarea {
    resize: vertical;
  }

  .rating-input {
    display: flex;
    gap: 0.25rem;
  }

  .star-btn {
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    color: #ddd;
    transition: color 0.2s;
  }

  .star-btn.active {
    color: #ffc107;
  }

  .star-btn:hover {
    color: #ffc107;
  }

  /* Stats */
  .reviews-stats {
    display: flex;
    gap: 2rem;
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: white;
    border-radius: 8px;
  }

  @media (max-width: 600px) {
    .reviews-stats {
      flex-direction: column;
    }
  }

  .stats-left {
    text-align: center;
    padding: 1rem;
  }

  .average-rating {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .rating-number {
    font-size: 3rem;
    font-weight: bold;
    color: var(--color-primary, #007bff);
  }

  .stars {
    color: #ffc107;
    font-size: 1.5rem;
  }

  .total-reviews {
    color: #666;
    margin-top: 0.5rem;
  }

  .stats-right {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .distribution-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .star-label {
    width: 40px;
    color: #666;
    font-size: 0.9rem;
  }

  .distribution-bar {
    flex: 1;
    height: 8px;
    background: #eee;
    border-radius: 4px;
    overflow: hidden;
  }

  .distribution-fill {
    height: 100%;
    background: #ffc107;
    transition: width 0.3s;
  }

  .distribution-row .count {
    width: 30px;
    text-align: right;
    color: #666;
    font-size: 0.9rem;
  }

  /* Sort Options */
  .sort-options {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    color: #666;
  }

  .sort-btn {
    background: none;
    border: 1px solid #ddd;
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .sort-btn.active {
    background: var(--color-primary, #007bff);
    color: white;
    border-color: var(--color-primary, #007bff);
  }

  /* Reviews List */
  .reviews-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .review-card {
    background: white;
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid #eee;
  }

  .review-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.75rem;
  }

  .review-author {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .author-name {
    font-weight: 600;
  }

  .verified-badge {
    background: #28a745;
    color: white;
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    font-size: 0.75rem;
    cursor: help;
  }

  .review-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.25rem;
  }

  .review-rating {
    color: #ffc107;
  }

  .review-date {
    font-size: 0.85rem;
    color: #999;
  }

  .review-title {
    margin: 0 0 0.5rem;
    font-size: 1.1rem;
  }

  .review-content {
    margin: 0;
    line-height: 1.6;
    white-space: pre-wrap;
  }

  /* No Reviews */
  .no-reviews {
    text-align: center;
    padding: 2rem;
    color: #666;
  }

  /* Pagination */
  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin-top: 1.5rem;
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

  .page-info {
    color: #666;
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: #666;
  }
</style>
