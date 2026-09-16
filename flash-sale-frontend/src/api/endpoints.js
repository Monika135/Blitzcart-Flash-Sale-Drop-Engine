/**
 * API CONTRACT
 * ------------
 * Matches the actual flash_sale_engine Django backend. Every function
 * below is what a page/component calls; each is documented with the
 * real HTTP method + path + request/response shape the backend
 * implements today.
 *
 * KEY DIFFERENCES FROM A "TYPICAL" REST API:
 * - Products are identified by SKU, not a numeric id.
 * - Payment is asynchronous: initiating a payment returns 202
 *   "processing" immediately. The gateway confirms or declines it
 *   later via a webhook, which the frontend never calls directly —
 *   instead, poll getReservationStatus() until it resolves.
 * - There's no `/orders/:id` endpoint. Once a reservation's status
 *   flips to "confirmed", getReservationStatus() includes the new
 *   orderId; the rest of the order summary is assembled client-side
 *   from data you already have (the product + the reservation).
 */

import { request, USE_MOCK, mockDelay } from './client';
import { mock } from './mockData';

/**
 * POST /users/login/
 * Body: { email, password }
 * Response: { access_token, refresh_token, user: { id, name, email } }
 */
export async function loginUser(email, password) {
  if (USE_MOCK) {
    await mockDelay(400);
    return mock.loginUser(email, password);
  }
  return request('/api/users/login/', {
    method: 'POST',
    body: { email, password },
  });
}

/**
 * POST /users/signup/
 * Body: { name, email, password }
 * Response: { access_token, refresh_token, user: { id, name, email } }
 */
export async function signupUser(name, email, password) {
  if (USE_MOCK) {
    await mockDelay(400);
    return mock.signupUser(name, email, password);
  }
  return request('/api/users/signup/', {
    method: 'POST',
    body: { name, email, password },
  });
}

function normalizeProduct(item) {
  if (!item) return null;
  const id = item.id || item.sku || '';
  const price = typeof item.price === 'number' ? item.price : Number(item.price) || 0;
  const priceCents = item.priceCents ?? (price > 0 ? Math.round((price * 100) / 83) : 14900);
  const totalStock = item.totalStock ?? item.total_stock ?? 0;
  const remainingStock = item.remainingStock ?? item.remaining_stock ?? 0;
  const viewersLive = item.viewersLive ?? Math.max(15, Math.min(900, remainingStock * 9 + 40));

  return {
    ...item,
    id,
    sku: id,
    name: item.name || id,
    subtitle: item.subtitle || item.description || '',
    price: price || Math.round((priceCents / 100) * 83),
    priceCents,
    totalStock,
    remainingStock,
    viewersLive,
    imageUrl: item.imageUrl || item.image_url || '',
    status: item.status || (remainingStock > 0 ? 'ACTIVE' : 'SOLD_OUT'),
  };
}

/**
 * GET /inventory/products/
 * Response: Array of {
 *   id, name, subtitle, priceCents, totalStock, remainingStock,
 *   viewersLive, status
 * }
 */
export async function getProducts() {
  if (USE_MOCK) {
    await mockDelay(300);
    return mock.getProducts();
  }
  const res = await request('/api/inventory/products/');
  const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
  return list.map(normalizeProduct).filter(Boolean);
}

/**
 * GET /inventory/products/:sku/
 * Response: {
 *   id, name, subtitle, priceCents, totalStock, remainingStock,
 *   viewersLive, status
 * }
 * remainingStock is read live from Redis on the backend, not computed
 * from the orders table on every request.
 */
export async function getProduct(sku) {
  if (USE_MOCK) {
    await mockDelay(300);
    return mock.getProduct(sku);
  }
  const res = await request(`/api/inventory/products/${sku}/`);
  const item = res?.data || res;
  return normalizeProduct(item);
}

/**
 * POST /orders/buy-now/
 * Body:     { sku, quantity, idempotency_key }
 * Response: { success: true, reservation: { id, product, quantity, status, created_at, expires_at }, replayed }
 * Errors:   404 if the SKU doesn't exist, 409 SOLD_OUT if stock is unavailable.
 * `idempotency_key` should be generated once per Buy Now attempt and
 * reused on retries of that same attempt so a flaky network never
 * double-reserves stock.
 */
export async function createReservation(sku, quantity, idempotencyKey) {
  if (USE_MOCK) {
    await mockDelay(400);
    return mock.createReservation(sku, quantity, idempotencyKey);
  }
  const data = await request('/api/orders/buy-now/', {
    method: 'POST',
    body: { sku, quantity, idempotency_key: idempotencyKey },
  });
  return data.reservation;
}

/**
 * GET /orders/reservations/:reservationId/status/
 * Response: { reservation_id, status, order_id? }
 * status is one of: 'pending' | 'confirmed' | 'expired' | 'cancelled'
 * `order_id` is only present once status is 'confirmed'.
 * Poll this while waiting on the payment webhook to land.
 */
export async function getReservationStatus(reservationId) {
  if (USE_MOCK) {
    await mockDelay(200);
    return mock.getReservationStatus(reservationId);
  }
  const res = await request(`/api/orders/reservations/${reservationId}/status/`);
  return res?.data || res;
}

/**
 * POST /orders/reservations/pay/
 * Body:     { card_token, reservation_id }
 * Response: 202 { payment_reference, status: 'processing', replayed }
 *           or 200 { order_id, product, user_id, quantity, created_at, replayed: true }
 *           if the reservation was already paid (replay-safe).
 * Errors:   409 if the reservation isn't pending, 410 if it expired.
 * This does NOT confirm the order — it starts an async charge. Keep
 * polling getReservationStatus() for the actual outcome.
 */
export async function initiatePayment(reservationId) {
  if (USE_MOCK) {
    await mockDelay(500);
    return mock.initiatePayment(reservationId);
  }
  return request('/api/orders/reservations/pay/', {
    method: 'POST',
    body: { reservation_id: reservationId },
  });
}

/**
 * POST /orders/reservations/cancel/
 * Body:     { reservation_id }
 * Response: { reservation_id, status: 'cancelled' }
 * Errors:   409 if a payment is currently in flight for this reservation
 *           (can't safely release stock while the gateway might still
 *           confirm it) or if the reservation isn't pending.
 */
export async function cancelReservation(reservationId) {
  if (USE_MOCK) {
    await mockDelay(300);
    return mock.cancelReservation(reservationId);
  }
  return request('/api/orders/reservations/cancel/', {
    method: 'POST',
    body: { reservation_id: reservationId },
  });
}

/**
 * GET /orders/admin/summary/
 * Response: {
 *   stockRemaining, stockTotal, ordersConfirmed,
 *   reservationsActive, needsReconciliation
 * }
 */
export async function getAdminSummary() {
  if (USE_MOCK) {
    await mockDelay(300);
    return mock.getAdminSummary();
  }
  return request('/api/orders/admin/summary/');
}

/**
 * GET /orders/admin/reconciliation/
 * Response: [{ paymentId, reservationId, sku, paymentStatus, inventoryStatus, suggestedAction }]
 * These are payment attempts whose gateway webhook never landed, or
 * that succeeded without a matching confirmed order — the direct
 * evidence of a failure in the async payment/inventory hand-off.
 */
export async function getReconciliationQueue() {
  if (USE_MOCK) {
    await mockDelay(300);
    return mock.getReconciliationQueue();
  }
  return request('/api/orders/admin/reconciliation/');
}

/**
 * POST /orders/admin/reconciliation/:paymentId/retry/
 * Response: { paymentId, status: 'resolved', orderId? }
 */
export async function retryReconciliation(paymentId) {
  if (USE_MOCK) {
    await mockDelay(500);
    return mock.retryReconciliation(paymentId);
  }
  return request(`/api/orders/admin/reconciliation/${paymentId}/retry/`, { method: 'POST' });
}
