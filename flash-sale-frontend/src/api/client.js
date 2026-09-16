/**
 * Central API client.
 *
 * WHY THIS FILE EXISTS:
 * Every request in the app funnels through `request()` below. That means
 * there is exactly ONE place that knows about base URLs, headers, error
 * shapes, and mock-vs-real switching. Pages and components never call
 * fetch() directly — they call functions in `endpoints.js`, which call
 * `request()`.
 *
 * HOW TO WIRE UP YOUR REAL BACKEND:
 * 1. Build your backend to match the contract documented in endpoints.js
 *    (method + path + request body + response shape for each function).
 * 2. In `.env`, set VITE_USE_MOCK=false and VITE_API_URL to your backend,
 *    e.g. http://localhost:8000/api
 * 3. Restart `npm run dev`. Nothing else changes — every page keeps
 *    working because they only ever imported from endpoints.js.
 */

export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
export const API_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '').trim();

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Low-level request helper. Always returns parsed JSON on success.
 * Throws ApiError on any non-2xx response.
 */
export async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const url = `${API_BASE_URL}${path}`;
  const token = localStorage.getItem('blitzcart_token') || localStorage.getItem('vibe_token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new ApiError(
      `Could not reach backend at ${url}. Is it running?`,
      0,
      { networkErr: String(networkErr) }
    );
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new ApiError(
      payload?.message || `Request failed with status ${res.status}`,
      res.status,
      payload
    );
  }

  return payload;
}

/** Simulates network latency in mock mode so loading states are visible and real. */
export function mockDelay(ms = 500) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { ApiError };
