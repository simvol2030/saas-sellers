/**
 * API Proxy - проксирование запросов к backend API
 *
 * Позволяет фронтенду использовать относительные пути /api/*
 * и проксирует их на backend сервер.
 */
import type { APIRoute } from 'astro';

const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3001';

export const ALL: APIRoute = async ({ params, request }) => {
  const path = params.path || '';
  const targetUrl = `${API_URL}/api/${path}`;

  try {
    // Clone headers, excluding host-specific ones
    const headers = new Headers();
    request.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey !== 'host' &&
        lowerKey !== 'connection' &&
        lowerKey !== 'content-length'
      ) {
        headers.set(key, value);
      }
    });

    // Forward the request
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body:
        request.method !== 'GET' && request.method !== 'HEAD'
          ? await request.text()
          : undefined,
    });

    // Clone response headers
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey !== 'transfer-encoding') {
        responseHeaders.set(key, value);
      }
    });

    // Return proxied response
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('API Proxy error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to connect to API server',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};

// Export handlers for common HTTP methods
export const GET = ALL;
export const POST = ALL;
export const PUT = ALL;
export const DELETE = ALL;
export const PATCH = ALL;
