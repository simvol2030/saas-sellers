/**
 * API Client with Automatic Token Refresh
 *
 * Handles authentication and automatic token refresh for API requests
 */

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refreshToken');

  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      // Refresh token is invalid or expired - clear storage and redirect to login
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/admin/login';
      return null;
    }

    const data = await response.json();
    const newAccessToken = data.accessToken;

    // Store new access token
    localStorage.setItem('accessToken', newAccessToken);
    return newAccessToken;
  } catch (error) {
    console.error('Token refresh failed:', error);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/admin/login';
    return null;
  }
}

/**
 * Fetch with automatic token refresh
 *
 * Usage:
 * ```ts
 * const data = await apiFetch('/api/admin/pages', {
 *   method: 'POST',
 *   body: JSON.stringify({ title: 'My Page' }),
 * });
 * ```
 */
export async function apiFetch<T = any>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { skipAuth = false, ...fetchOptions } = options;

  // Get access token
  let accessToken = localStorage.getItem('accessToken');

  // Redirect to login if no token and auth is required
  if (!accessToken && !skipAuth) {
    window.location.href = '/admin/login';
    throw new Error('No access token');
  }

  // Prepare headers
  const headers = new Headers(fetchOptions.headers);
  if (accessToken && !skipAuth) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  if (fetchOptions.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Make request
  let response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  // If unauthorized and not skipping auth, try to refresh token
  if (response.status === 401 && !skipAuth) {
    const newAccessToken = await refreshAccessToken();

    if (newAccessToken) {
      // Retry request with new token
      headers.set('Authorization', `Bearer ${newAccessToken}`);
      response = await fetch(url, {
        ...fetchOptions,
        headers,
      });
    } else {
      // Refresh failed - user will be redirected to login
      throw new Error('Authentication failed');
    }
  }

  // Parse response
  const data = await response.json();

  // Throw on error
  if (!response.ok) {
    const error: any = new Error(data.error || `HTTP ${response.status}`);
    error.response = response;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!localStorage.getItem('accessToken');
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  const refreshToken = localStorage.getItem('refreshToken');

  if (refreshToken) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });
    } catch (error) {
      console.error('Logout API call failed:', error);
    }
  }

  // Clear tokens
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');

  // Redirect to login
  window.location.href = '/admin/login';
}
