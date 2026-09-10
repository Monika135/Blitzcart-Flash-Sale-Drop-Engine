/**
 * In-memory mock "backend". Mirrors the real flash_sale_engine
 * contract (see endpoints.js) so flipping VITE_USE_MOCK=false is a
 * no-op for every page — including the async, webhook-style payment
 * flow. To keep the mock demo snappy, the "webhook" fires itself
 * automatically a moment after payment is initiated instead of
 * requiring a manual `simulate_webhook.py` call like the real backend.
 */

const RESERVATION_HOLD_MS = 2 * 60 * 1000;
const MOCK_WEBHOOK_DELAY_MS = 1400;
const DECLINE_CARD_NUMBERS = new Set(['4000 0000 0000 0002', '4000000000000002']);

const state = {
  products: new Map([
    [
      'AJ1-BRED-10',
      {
        sku: 'AJ1-BRED-10',
        name: 'Nebula Runner, Sour Apple Drop',
        subtitle: 'Limited edition, 100 units',
        priceCents: 14900,
        totalStock: 100,
        remainingStock: 7,
      },
    ],
    [
      'AJ1-STEALTH-11',
      {
        sku: 'AJ1-STEALTH-11',
        name: 'Midnight Stealth Edition',
        subtitle: 'High-top black & slate grey, 150 units',
        priceCents: 16900,
        totalStock: 150,
        remainingStock: 14,
      },
    ],
    [
      'AJ1-ROYAL-12',
      {
        sku: 'AJ1-ROYAL-12',
        name: 'Royal Vapor Wave',
        subtitle: 'Synthwave blue & purple, 120 units',
        priceCents: 15900,
        totalStock: 120,
        remainingStock: 0,
      },
    ],
    [
      'AJ1-CITRON-13',
      {
        sku: 'AJ1-CITRON-13',
        name: 'Electro Citron Volt',
        subtitle: 'Cyberpunk yellow & carbon, 80 units',
        priceCents: 13900,
        totalStock: 80,
        remainingStock: 45,
      },
    ],
  ]),
  reservations: new Map(), // id -> { id, sku, quantity, status, created_at, expires_at, paymentToken }
  orders: new Map(), // id -> { orderId, reservationId, sku, quantity }
  reconciliationQueue: [],
};

let reservationCounter = 1000;
let orderCounter = 84213;
let paymentCounter = 1;

function viewersFor(remaining) {
  return Math.max(15, Math.min(900, remaining * 9 + 40));
}

function serializeProduct(p) {
  return {
    id: p.sku,
    name: p.name,
    subtitle: p.subtitle,
    priceCents: p.priceCents,
    totalStock: p.totalStock,
    remainingStock: p.remainingStock,
    viewersLive: viewersFor(p.remainingStock),
    status: p.remainingStock > 0 ? 'ACTIVE' : 'OUT_OF_STOCK',
  };
}

export const mock = {
  async loginUser(email, password) {
    if (email && password.length >= 6) {
      return {
        access_token: 'mock_jwt_access_token',
        refresh_token: 'mock_jwt_refresh_token',
        user: {
          id: 999,
          name: email.split('@')[0].toUpperCase(),
          email: email,
        }
      };
    } else {
      const err = new Error('Invalid email or password (min 6 characters)');
      err.status = 400;
      throw err;
    }
  },

  async signupUser(name, email, password) {
    if (name && email && password.length >= 6) {
      return {
        access_token: 'mock_jwt_access_token',
        refresh_token: 'mock_jwt_refresh_token',
        user: {
          id: 999,
          name: name,
          email: email,
        }
      };
    } else {
      const err = new Error('All fields are required and password must be at least 6 chars.');
      err.status = 400;
      throw err;
    }
  },

  async getProducts() {
    return [...state.products.values()].map(serializeProduct);
  },

  async getProduct(sku) {
    const p = state.products.get(sku);
    if (!p) {
      const err = new Error('Product not found');
      err.status = 404;
      err.body = { error: `Product not found for SKU '${sku}'` };
      throw err;
    }
    return serializeProduct(p);
  },

  async createReservation(sku, quantity = 1, idempotencyKey) {
    const existing = [...state.reservations.values()].find(
      (r) => r.idempotencyKey === idempotencyKey
    );
    if (existing) return { ...existing, replayed: true };

    const p = state.products.get(sku);
    if (!p) {
      const err = new Error('Product not found');
      err.status = 404;
      err.body = { error: `Product not found for SKU '${sku}'` };
      throw err;
    }
    if (p.remainingStock < quantity) {
      const err = new Error('Out of stock');
      err.status = 409;
      err.body = { error: 'Out of stock' };
      throw err;
    }
    p.remainingStock -= quantity;

    const id = `res_${reservationCounter++}`;
    const reservation = {
      id,
      sku,
      quantity,
      status: 'pending',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + RESERVATION_HOLD_MS).toISOString(),
      idempotencyKey,
    };
    state.reservations.set(id, reservation);
    return { ...reservation, replayed: false };
  },

  async getReservationStatus(reservationId) {
    const r = state.reservations.get(reservationId);
    if (!r) {
      const err = new Error('Reservation not found');
      err.status = 404;
      throw err;
    }
    const body = { reservation_id: r.id, status: r.status };
    if (r.status === 'confirmed') {
      const order = [...state.orders.values()].find((o) => o.reservationId === r.id);
      body.order_id = order?.orderId;
    }
    return body;
  },

  async initiatePayment(reservationId, cardToken) {
    const r = state.reservations.get(reservationId);
    if (!r) {
      const err = new Error('Reservation not found');
      err.status = 404;
      throw err;
    }
    if (r.status === 'confirmed') {
      const order = [...state.orders.values()].find((o) => o.reservationId === r.id);
      return { order_id: order?.orderId, replayed: true };
    }
    if (r.status !== 'pending') {
      const err = new Error(`Reservation is '${r.status}', cannot pay`);
      err.status = 409;
      throw err;
    }
    if (new Date(r.expires_at).getTime() < Date.now()) {
      r.status = 'expired';
      const p = state.products.get(r.sku);
      if (p) p.remainingStock += r.quantity;
      const err = new Error('Reservation expired');
      err.status = 410;
      throw err;
    }

    if (r._paymentInFlight) {
      return { payment_reference: r._paymentReference, status: 'processing', replayed: true };
    }

    const reference = `pi_mock_${paymentCounter++}`;
    r._paymentInFlight = true;
    r._paymentReference = reference;

    // Simulate the gateway calling our webhook a moment later, exactly
    // like scripts/simulate_webhook.py does against the real backend.
    setTimeout(() => {
      if (r.status !== 'pending') return; // cancelled/expired in the meantime
      if (DECLINE_CARD_NUMBERS.has(cardToken)) {
        r.status = 'cancelled';
        const p = state.products.get(r.sku);
        if (p) p.remainingStock += r.quantity;
        return;
      }
      r.status = 'confirmed';
      const orderId = `VE-${orderCounter++}`;
      state.orders.set(orderId, { orderId, reservationId: r.id, sku: r.sku, quantity: r.quantity });
    }, MOCK_WEBHOOK_DELAY_MS);

    return { payment_reference: reference, status: 'processing', replayed: false };
  },

  async cancelReservation(reservationId) {
    const r = state.reservations.get(reservationId);
    if (!r) {
      const err = new Error('Reservation not found');
      err.status = 404;
      throw err;
    }
    if (r.status !== 'pending') {
      const err = new Error(`Reservation is '${r.status}', cannot cancel`);
      err.status = 409;
      throw err;
    }
    if (r._paymentInFlight) {
      const err = new Error('A payment is currently in progress for this reservation');
      err.status = 409;
      throw err;
    }
    const p = state.products.get(r.sku);
    if (p) p.remainingStock += r.quantity;
    r.status = 'cancelled';
    return { reservation_id: r.id, status: r.status };
  },

  async getAdminSummary() {
    const products = [...state.products.values()];
    return {
      stockRemaining: products.reduce((sum, p) => sum + p.remainingStock, 0),
      stockTotal: products.reduce((sum, p) => sum + p.totalStock, 0),
      ordersConfirmed: state.orders.size,
      reservationsActive: [...state.reservations.values()].filter((r) => r.status === 'pending')
        .length,
      needsReconciliation: state.reconciliationQueue.length,
    };
  },

  async getReconciliationQueue() {
    return [...state.reconciliationQueue];
  },

  async retryReconciliation(paymentId) {
    state.reconciliationQueue = state.reconciliationQueue.filter(
      (item) => item.paymentId !== paymentId
    );
    return { paymentId, status: 'resolved' };
  },
};
