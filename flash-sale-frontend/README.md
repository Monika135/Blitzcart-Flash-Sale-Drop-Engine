# VibeEnergy Flash Sale — Frontend

React + Vite + Tailwind frontend for the flash-sale / overselling-prevention
project. Runs completely standalone against an in-memory mock "backend" —
no server required to see it working.

## Run it

```bash
npm install
cp .env.example .env
npm run dev
```

Open the printed local URL. You'll land on the product page. Buy the item,
watch the checkout countdown, complete payment, and check `/admin` for the
live ops dashboard with a reconciliation queue.

## Project structure

```
src/
  api/
    client.js       # single fetch wrapper — base URL, error shape, mock switch
    endpoints.js     # every API call the app makes, documented with the
                      # exact method/path/request/response your backend must match
    mockData.js      # in-memory mock backend (stock, reservations, orders)
  context/
    ReservationContext.jsx   # shares the active reservation/order across pages
  hooks/
    useCountdown.js          # drives the reservation hold timer
    useStockPolling.js       # polls product stock, swap for websocket later
  components/                # StockBanner, CountdownBadge, StatCard, Button...
  pages/
    ProductPage.jsx          # buy now / reserve
    CheckoutPage.jsx         # payment + countdown
    ConfirmationPage.jsx     # order confirmed
    AdminDashboard.jsx       # live stock, orders, reconciliation queue
```

## Wiring up your real backend

This is the part that matters: **every page only ever calls functions from
`src/api/endpoints.js`.** No page touches `fetch` directly. That means
connecting your real backend is a two-line change, not a rewrite:

1. Build your backend so each endpoint matches the contract documented as a
   comment above each function in `src/api/endpoints.js` — method, path,
   request body, response shape, and error codes are all specified there.
2. In `.env`:
   ```
   VITE_USE_MOCK=false
   VITE_API_URL=http://localhost:8000/api
   VITE_RAZORPAY_KEY_ID=rzp_test_your_public_key
   VITE_RAZORPAY_CALLBACK_URL=http://localhost:5173/checkout
   ```
3. Restart `npm run dev`. Every page keeps working exactly as before,
   because they were never talking to the mock directly — `endpoints.js`
   was the only thing that knew.

### Endpoint contract summary

| Method | Path                                    | Purpose                                  |
|--------|------------------------------------------|-------------------------------------------|
| GET    | `/products/:productId`                   | product details + live stock              |
| POST   | `/reservations`                          | attempt to hold stock (the concurrency-critical one) |
| GET    | `/reservations/:reservationId`           | poll reservation status                   |
| POST   | `/reservations/:reservationId/checkout`  | charge payment, confirm order              |
| GET    | `/orders/:orderId`                       | fetch a confirmed order                    |
| GET    | `/admin/dashboard`                       | live stock/order stats                     |
| GET    | `/admin/reconciliation`                  | orders where payment/inventory disagree    |
| POST   | `/admin/reconciliation/:orderId/retry`   | resolve a reconciliation item              |

CORS note: once you build the backend, enable CORS for `http://localhost:5173`
(Vite's dev server) or requests from this frontend will be blocked by the browser.

## Design tokens (Tailwind)

Grounded in the product (a sour-apple energy drink flash drop):

- `base` `#14101F` — grape-black background
- `base-raised` `#1E1830` — card surfaces
- `sour` `#C4F135` — primary action, sour-apple lime
- `alert` `#FF5C8A` — urgency/danger states
- Fonts: Archivo Black (display), Inter (body), JetBrains Mono (stock counters, timers, order IDs)
