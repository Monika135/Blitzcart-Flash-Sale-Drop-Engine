
# ⚡ Blitzcart — High-Concurrency Flash Sale Drop Engine

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-5.0+-092E20?style=for-the-badge&logo=django&logoColor=white)](https://www.djangoproject.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7.0+-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Celery](https://img.shields.io/badge/Celery-5.4+-37814A?style=for-the-badge&logo=celery&logoColor=white)](https://docs.celeryq.dev/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Razorpay](https://img.shields.io/badge/Razorpay-Payment_Gateway-0C2340?style=for-the-badge&logo=razorpay&logoColor=white)](https://razorpay.com/)

> A production-grade, **zero-oversell** flash sale drop engine built to survive extreme concurrent traffic (sneaker drops, ticket releases, doorbusters) without overselling inventory, deadlocking Postgres, or dropping transactions.
>
> This README reflects the **corrected, fully real** version of the system: no mock payment gateway, no simulated webhooks. Payments run entirely through real Razorpay orders and real Razorpay webhooks.

---

## 📑 Table of Contents

1. [Why This Exists](#-why-this-exists)
2. [How It's Solved](#-how-its-solved)
3. [Architecture at a Glance](#-architecture-at-a-glance)
4. [Core Technical Innovations](#-core-technical-innovations)
5. [Project Structure](#-project-structure)
6. [API Reference](#-api-reference)
7. [Setup Guide](#-setup-guide)
8. [Real Payment Webhook Setup (ngrok)](#-real-payment-webhook-setup-ngrok)
9. [Concurrency & Load Testing](#-concurrency--load-testing)
10. [Functional Test Matrix](#-functional-test-matrix)

---

## 🎯 Why This Exists

During a flash sale — a limited sneaker drop, a concert ticket release, a doorbuster — tens of thousands of people hit **"Buy Now"** in the same millisecond for maybe 50–100 units of stock. Naive e-commerce backends fall over in predictable ways:

| Problem | What Actually Happens |
|---|---|
| **Race conditions / overselling** | Two requests both `SELECT stock` before either `UPDATE`s it. Both see stock available, both succeed, and stock goes negative. |
| **Lock contention collapse** | Fixing the above with `SELECT ... FOR UPDATE` serializes every request onto one DB row, exhausting the connection pool and pushing latency past 10s under burst load. |
| **Phantom inventory starvation** | Payments are asynchronous (OTP, 3D Secure, UPI can take minutes). Decrement stock permanently up front and abandoned checkouts lock items forever; wait for payment to decrement and you oversell while payments are in flight. |
| **Double-clicks & retries** | Impatient users and flaky mobile networks send duplicate requests. Without idempotency, one buyer can claim multiple units or get double-charged. |
| **Gateway/webhook disconnect** | Real payment gateways don't confirm synchronously. You need deferred webhook handling, signature verification, and deduplication — or you'll double-fulfill or miss cancellations. |

```
Traditional Naive Flow:
Client Request ──▶ SELECT stock FROM product WHERE id = 1 ──▶ [stock = 1]
Client Request ──▶ SELECT stock FROM product WHERE id = 1 ──▶ [stock = 1]  (RACE CONDITION)
Both pass! ─────▶ UPDATE product SET stock = stock - 1 ────▶ Stock drops to -1 (OVERSOLD)
```

---

## 🛡️ How It's Solved

Blitzcart's guarantee, at all times: **`0 <= remaining_stock <= total_stock`.**

It gets there with a **dual-store hot/cold architecture**:

- **Hot path — Redis + Lua**: a single atomic check-and-decrement, executed as one script on Redis's single-threaded event loop, so no two requests can ever both "win" the same unit of stock. Sub‑2ms response, even at massive concurrency.
- **Cold path — PostgreSQL**: the durable, ACID system of record for users, products, reservations, payments, and orders.
- **Two-phase reservation, not an instant sale**: winning the Redis race only places a **10‑minute hold**. The hold becomes a real `Order` only once a real Razorpay payment is confirmed via webhook. If payment fails or the hold times out, stock is atomically returned to Redis.
- **End-to-end idempotency**: every Buy Now request carries a client-generated UUID. Duplicate submissions — double-clicks, retried requests — replay the original reservation instead of taking a second unit, with a database-level compensating transaction as the final backstop.
- **Real payments only**: Razorpay order creation and webhook/signature verification are the only path to a confirmed order. There is no mock gateway and no fake webhook simulator — a misconfigured or unreachable gateway fails loudly with `502`, never silently.

---

## 🏛️ Architecture at a Glance

```
Client
  │  POST /api/orders/buy-now/   { sku, quantity, idempotency_key }
  ▼
BuyNowAPIView → services.create_buy_now_reservation()
  │
  ├── 1. idempotency_key already seen?  → replay existing reservation (200, replayed:true)
  ├── 2. Product exists in Postgres?    → else 404
  ├── 3. Redis Lua: atomic GET + DECR "stock:<sku>"  → stock < qty ⇒ 409 Conflict
  └── 4. Reservation row created (status=pending, expires_at = now + 10 min)
  ▼
Reservation (Postgres) ── POST /api/orders/reservations/pay/ ──▶ InitiatePaymentView
  │                                                                   │
  │                                                 create_payment_intent()
  │                                                 → real Razorpay Order (paise, INR)
  │                                                   or 502 if Razorpay unreachable/misconfigured
  │                                                                   │
  │                                          Payment row (status=pending) created
  ▼                                                                   ▼
                                                        Razorpay Checkout (Cards / UPI / NetBanking / Wallets)
                                                                   │
                                     POST /api/orders/payments/webhook/  (PaymentWebhookView, no auth required)
                                                                   │
                          ┌────────────────────────────────────────┴───────────────────────────┐
                          ▼                                                                      ▼
              payment.captured / order.paid                                             payment.failed
              → Payment = success, Order created,                                       → release_stock()
                Reservation = confirmed                                                   Payment = failed
                                                                                            Reservation = cancelled

Background (Celery beat, every 30s):
  orders.tasks.expire_stale_reservations
    → releases Redis stock for any reservation whose 10-minute TTL has passed
    → flips it to Reservation.STATUS_EXPIRED
```

**Why Redis + Lua instead of just a DB row?** Running `GET` then `DECRBY` as two separate commands — in Redis or as two SQL statements — reopens the race window: two requests can both read "stock = 1" before either writes back, and both think they won. A Lua script registered on the Redis server runs the check-and-decrement as **one atomic unit**, so this is structurally impossible no matter how many requests land in the same millisecond.

```lua
local stock = redis.call('GET', KEYS[1])
if stock == false then
    return -1 -- Key uninitialized
end
stock = tonumber(stock)
local qty = tonumber(ARGV[1])
if stock >= qty then
    redis.call('DECRBY', KEYS[1], qty)
    return 1 -- Success
else
    return 0 -- Out of stock
end
```

---

## ⚡ Core Technical Innovations

### 1. Atomic Check-and-Decrement via Redis Lua
When an item sells out, requests fail at Redis in **under 2ms** with `HTTP 409`, entirely shielding PostgreSQL and application workers from load — no database write locks are ever touched by a losing request.

### 2. Two-Phase Reservation with a 10-Minute Hold
Stock is never permanently deducted at "Buy Now" time:
1. Winning the Redis race places a **10-minute hold** (`Reservation.status = 'pending'`).
2. Payment success within the window converts the hold into a durable `Order`.
3. Abandonment or failure releases the unit back to the live pool via `INCRBY stock:<sku>`, so "sold out" items naturally reappear mid-drop.

### 3. Celery Stale-Reservation Sweeper
A periodic Celery Beat task garbage-collects unpaid holds every 30 seconds:
```python
@shared_task
def expire_stale_reservations():
    stale = Reservation.objects.select_related("product").filter(
        status=Reservation.STATUS_PENDING,
        expires_at__lt=timezone.now(),
    )
    for reservation in stale:
        release_stock(reservation.product.sku, reservation.quantity)
        reservation.status = Reservation.STATUS_EXPIRED
        reservation.save(update_fields=["status"])
```
`InitiatePaymentView` also performs this release lazily on-demand (returning `410 Gone`) as a safety net if the beat task hasn't run yet.

### 4. End-to-End Idempotency with Database Collision Compensation
- **Level 1 (replay check)**: a previously-seen `idempotency_key` returns the existing reservation without touching Redis again.
- **Level 2 (race compensation)**: if two identical requests slip past that check simultaneously, PostgreSQL's unique constraint on `idempotency_key` raises `IntegrityError`. The handler immediately gives the wrongly-taken stock back to Redis and returns the original winning reservation:
```python
try:
    reservation = Reservation.objects.create(...)
except IntegrityError:
    release_stock(sku, quantity)  # compensating transaction
    return Reservation.objects.get(idempotency_key=idempotency_key), True
```

### 5. Real Razorpay Payment Pipeline — Zero Mocks
- Real order creation via `razorpay_client.order.create(...)`.
- Cryptographic HMAC-SHA256 verification for both inbound server webhooks (`X-Razorpay-Signature`, keyed on `RAZORPAY_WEBHOOK_SECRET`) and client-side checkout modal callbacks (keyed on `RAZORPAY_KEY_SECRET`).
- Webhook delivery is deduplicated through a durable `WebhookEvent` table, so gateway retries are strictly idempotent (`"already processed"`, no double-fulfillment).
- If Razorpay is unreachable or unconfigured, `InitiatePaymentView` returns a clear `502 Bad Gateway` — it never falls back to a fake `pi_xxxx`-style reference that only *looks* like a real charge.

### 6. Auth & Rate Limiting
- Hand-rolled stateless JWT (HS256) via `JWTAuthMiddleware`, gating everything under `/api/inventory/` and `/api/orders/` by URL prefix — except the webhook endpoint, since the gateway can't log in.
- A sliding-window Redis rate limiter (`RateLimitMiddleware`) caps traffic at 100 req/min per IP, keying off `X-Forwarded-For` when present so it plays nicely behind proxies/CDNs and with concurrent load-testing scripts.

---

## 📂 Project Structure

```
Blitzcart-Flash-Sale-Drop-Engine/
├── flash-sale-backend/                # Django REST Framework backend
│   ├── flash_sale_engine/             # Settings, Celery app, Razorpay client
│   ├── inventory/                     # Product model, Redis Lua client, catalog APIs
│   │   └── management/commands/       # seed_product, init_stock
│   ├── orders/                        # Reservation → Payment → Order lifecycle
│   │   ├── services.py                # Core reservation engine
│   │   ├── payment_gateway.py         # Razorpay order creation & signature verification
│   │   ├── tasks.py                   # expire_stale_reservations (Celery)
│   │   └── views.py                   # BuyNow, InitiatePayment, Webhook, Status, Cancel
│   ├── users/                         # Signup/Login, hand-rolled JWT, middleware
│   ├── scripts/
│   │   └── load_test_buy_now.py       # Real, working concurrency load tester
│   └── requirements.txt
│
└── flash-sale-frontend/               # React + Vite + Tailwind CSS
    └── src/
        ├── api/                       # Fetch client + documented endpoint contracts
        ├── context/                   # Auth & active-reservation state
        ├── hooks/                     # Countdown timer, stock polling, status polling
        └── pages/                     # Drop Arena, Checkout, Confirmation, Auth
```

> **Note on scope:** there is intentionally **no admin/reconciliation dashboard** in this codebase. An earlier pass referenced a `reconciliation` module and admin views that were never implemented or wired into `urls.py` — they've been removed rather than left as dead code. If you need that surface, it's a feature to build, not a bug to fix.

---

## 🔌 API Reference

All endpoints return JSON. Protected endpoints require `Authorization: Bearer <access_token>`. The only unauthenticated `/api/orders/` or `/api/inventory/` route is the payment webhook.

### Auth

| Endpoint | Notes |
|---|---|
| `POST /api/users/signup/` | Returns `201` with `access_token`, `refresh_token`, `user`. `400` on duplicate email. |
| `POST /api/users/login/` | Returns `200` with the same token shape. `401` on bad credentials. |
| `GET /api/users/` | List users; `401` without a token. |

Access tokens are valid 24h, refresh tokens 30 days — but **there is no `/refresh/` endpoint wired up**. `generate_refresh_token` exists but nothing currently consumes a refresh token to mint a new access token; re-login is the only way to get a fresh one today.

### Inventory (protected)

| Endpoint | Notes |
|---|---|
| `GET /api/inventory/products/` | Live catalog with `remainingStock`. If `init_stock` hasn't been run yet, it falls back to computing `remainingStock = total_stock - sold_count` straight from Postgres instead of Redis — the response shape is the same either way, but the source of truth differs. |
| `GET /api/inventory/products/<sku>/` | Single-SKU live poll. `404` for an unknown SKU. |

### Orders

| Endpoint | Success | Failure Modes |
|---|---|---|
| `POST /api/orders/buy-now/` | `201` new reservation (`replayed:false`) or `200` idempotent replay (`replayed:true`, stock untouched) | `404` unknown SKU · `409` out of stock |
| `POST /api/orders/reservations/pay/` | `202` real Razorpay order created, `status:"processing"` | `202`/`200` `replayed:true` if already in flight or confirmed · `404` unknown reservation · `409` reservation not pending · `410` TTL expired (stock auto-released) · `502` Razorpay unreachable/misconfigured |
| `GET /api/orders/reservations/<id>/status/` | `200`, `order_id` present once `status:"confirmed"` | `404` unknown id |
| `POST /api/orders/payments/webhook/` (no auth) | `200` `"order confirmed"` · `200` `"payment failed, stock released"` · `200` `"already processed"` (dedup) | `401` bad/missing `X-Razorpay-Signature` · `404` unmatched reference |
| `POST /api/orders/reservations/cancel/` | `200` cancelled, stock released | `400` missing `reservation_id` · `404` unknown reservation · `409` not pending / payment currently in flight |

**Example — Buy Now request:**
```json
{
  "sku": "AJ1-BRED-10",
  "quantity": 1,
  "idempotency_key": "c7a8684d-2ef8-498b-bc19-5d272998a69e"
}
```

**Example — Buy Now response (fresh win):**
```json
{
  "success": true,
  "reservation": {
    "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "product": 1,
    "quantity": 1,
    "status": "pending",
    "created_at": "2026-09-17T12:00:00Z",
    "expires_at": "2026-09-17T12:10:00Z"
  },
  "replayed": false
}
```

---

## 🛠️ Setup Guide

### Prerequisites
- Python 3.11+
- Node.js 18+ (frontend)
- PostgreSQL 14+ on port `5432`
- Redis 6.2+ on port `6379`
- *(optional, for real payments)* ngrok

### 1. Backend

```bash
cd flash-sale-backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env`:

```ini
# Database (PostgreSQL)
DATABASE_NAME=flash_sale_engine
DATABASE_USER=postgres
DATABASE_PASSWORD=your_postgres_password
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_SCHEMA=public

# Redis & Celery
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1

# Razorpay test credentials — required, not optional.
# create_payment_intent() raises a 502 if these are missing rather
# than silently faking a payment reference.
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Network & CORS
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Migrate and seed:

```bash
python manage.py migrate
python manage.py seed_product          # 20 sample SKUs
python manage.py init_stock --all      # copy Postgres total_stock → Redis stock:<sku>
```

Run it:

```bash
python manage.py runserver 0.0.0.0:8000

# optional, in separate terminals — enables 10-minute hold expiry:
celery -A flash_sale_engine worker -l info
celery -A flash_sale_engine beat -l info
```

### 2. Frontend

```bash
cd ../flash-sale-frontend
npm install
cp .env.example .env
```

```ini
VITE_USE_MOCK=false
VITE_API_URL=http://localhost:8000/api
VITE_RAZORPAY_KEY_ID=rzp_test_your_key_id
VITE_RAZORPAY_CALLBACK_URL=http://localhost:5173/checkout
VITE_PRODUCT_SKU=AJ1-BRED-10
```

```bash
npm run dev
```

Open `http://localhost:5173`.

---

## 🔗 Real Payment Webhook Setup (ngrok)

Because there's no mock gateway, exercising the full pay → webhook → confirmed flow needs Razorpay to actually reach your machine:

```bash
ngrok http 8000
```

Then, in **Razorpay Dashboard → Settings → Webhooks → Add New Webhook**:

- **URL**: `https://<your-ngrok-subdomain>.ngrok-free.app/api/orders/payments/webhook/`
- **Secret**: must match `RAZORPAY_WEBHOOK_SECRET` in `.env`
- **Events**: `payment.captured`, `payment.failed`, `order.paid`

`ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` already whitelist `*.ngrok-free.app` and `*.ngrok.io`, so no further config is needed.

**Without ngrok**, you can still test everything through `InitiatePaymentView` — you just won't see a reservation flip to `confirmed` unless you complete a real Razorpay test-mode payment (test card `4111 1111 1111 1111`, any future expiry/CVV) or hand-craft a signed webhook call yourself:

```bash
BODY='{"id":"evt_test_1","event":"payment.captured","payload":{"payment":{"entity":{"order_id":"<payment_reference>","error_description":""}}}}'
SIG=$(python3 -c "import hmac,hashlib,sys,os; print(hmac.new(os.environ['RAZORPAY_WEBHOOK_SECRET'].encode(), sys.argv[1].encode(), hashlib.sha256).hexdigest())" "$BODY")

curl -X POST http://localhost:8000/api/orders/payments/webhook/ \
  -H "Content-Type: application/json" \
  -H "X-Razorpay-Signature: $SIG" \
  -d "$BODY"
```
For a decline, set `"event":"payment.failed"` and populate `"error_description"`.

---

## 🧪 Concurrency & Load Testing

This is the invariant the whole design exists to prove: **the number of successful reservations never exceeds the stock you started with**, no matter how many concurrent requests arrive.

### 1. Reset stock to a known baseline
```bash
python manage.py init_stock MEN-TSHIRT-BLACK-001
```

### 2. Get a token
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/users/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Passw0rdSecure!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
```

### 3. Fire the burst
```bash
python scripts/load_test_buy_now.py \
  --base-url http://localhost:8000 \
  --token "$TOKEN" \
  --sku MEN-TSHIRT-BLACK-001 \
  --requests 500 \
  --workers 100
```

Each request gets its own `idempotency_key` and a unique spoofed `X-Forwarded-For`, so the tool models distinct buyers and dodges the local per-IP rate limit.

Expected output:
```text
Firing 500 concurrent buy-now requests for SKU 'MEN-TSHIRT-BLACK-001'

  201: 120   Created (reservation won)
  409: 380   Conflict (out of stock)

Initial stock: 120
Successful reservations (201): 120
Redis stock:MEN-TSHIRT-BLACK-001 after test: 0

PASS: successes == initial stock, and remaining stock == 0. No overselling.
```

### 4. Idempotency-under-race test
Simulate 50 threads retrying the exact same double-click:
```bash
python scripts/load_test_buy_now.py \
  --base-url http://localhost:8000 \
  --token "$TOKEN" \
  --sku MEN-TSHIRT-BLACK-001 \
  --requests 50 \
  --workers 50 \
  --same-idempotency-key
```
Expected: exactly **one** `201`; the other 49 responses are `200`s with `replayed: true` and the same reservation id. Stock drops by **1**, not 50 — if it drops by more, the `IntegrityError` compensation path is failing.

### Going further
- Watch Postgres, not just Redis: `SELECT COUNT(*) FROM orders_reservation WHERE status='pending';` should exactly equal your successful-reservation count, and no `idempotency_key` should ever appear more than once.
- For a closer-to-production simulation, pre-create N real user accounts and cycle a token pool across threads instead of sharing one JWT.
- A real flash sale ramps over 1–5 seconds rather than firing as one instantaneous burst — tools like `k6`, `locust`, or `hey` model that ramp more realistically once the core correctness check above passes.

---

## 📋 Functional Test Matrix

| # | Scenario | Expected Result |
|---|---|---|
| T1 | Signup with new email | `201`, tokens + user returned |
| T2 | Signup with duplicate email | `400`, unique-email violation |
| T3 | Login, correct credentials | `200`, tokens returned |
| T4 | Login, wrong password | `401`, `{"error": "Invalid credentials"}` |
| T5 | Unauthenticated inventory access | `401` |
| T6 | Unauthenticated orders access | `401` |
| T7 | List products before `init_stock` | `200`, Postgres-derived list |
| T8 | List products after `init_stock --all` | `200`, `remainingStock` sourced from Redis |
| T9 | Get one product, valid SKU | `200`, live Redis stock |
| T10 | Get one product, invalid SKU | `404` |
| T11 | Buy Now happy path | `201`, `replayed:false`, stock −1 |
| T12 | Buy Now idempotent replay (same key) | `200`, `replayed:true`, stock unchanged |
| T13 | Buy Now, unknown SKU | `404` |
| T14 | Buy Now, stock at 0 | `409`, `{"error":"Out of stock"}` |
| T15 | Initiate payment, valid reservation | `202`, real Razorpay `order_xxx`, `status:"processing"` |
| T16 | Initiate payment twice in flight | `202`, `replayed:true`, same reference |
| T17 | Initiate payment, unknown reservation | `404` |
| T17b | Initiate payment, Razorpay misconfigured | `502`, clear error — no fake reference |
| T18 | Webhook: payment succeeded | `200` `"order confirmed"`, reservation → `confirmed`, `Order` created |
| T19 | Webhook: duplicate delivery | `200` `"already processed"`, no second `Order` |
| T20 | Webhook: bad signature | `401` |
| T21 | Webhook: unknown reference | `404` |
| T22 | Webhook: payment failed | `200` `"payment failed, stock released"`, reservation → `cancelled` |
| T23 | Reservation status polling | `200`, `status:"confirmed"`, `order_id` present |
| T24 | Reservation status, unknown id | `404` |
| T25 | Reservation TTL expiry (>10 min unpaid) | `410 Gone` on `pay/`, stock released back |
| T26 | Rate limiting (>100 req/min, one IP) | `429` |
| T27 | Cancel a pending reservation | `200`, `status:"cancelled"`, stock released |
| T28 | Cancel while payment in flight | `409`, cannot cancel mid-charge |

---

## 📜 License & Credits

Built to demonstrate production-level concurrency patterns, distributed systems resilience, and bulletproof transactional integrity in a real-world flash-sale scenario.
