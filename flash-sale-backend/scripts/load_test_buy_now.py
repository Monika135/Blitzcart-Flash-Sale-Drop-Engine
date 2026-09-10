"""
Fires many concurrent Buy Now requests at one SKU against a live dev server
and verifies that the number of successful reservations never exceeds the
stock you initialized. This is the real, working correctness check for the
flash-sale engine's core guarantee: no overselling under concurrency.

Before running, set stock to a known value:
    python manage.py init_stock <SKU>

Usage:
    python scripts/load_test_buy_now.py \
        --base-url http://localhost:8000 \
        --token "$TOKEN" \
        --sku AJ1-BRED-10 \
        --requests 500 \
        --workers 100

Idempotency-under-race check (same click retried by many threads at once):
    python scripts/load_test_buy_now.py \
        --base-url http://localhost:8000 \
        --token "$TOKEN" \
        --sku AJ1-BRED-10 \
        --requests 50 \
        --workers 50 \
        --same-idempotency-key

Pass criteria: count(201) == the stock you initialized, and remaining stock
ends at exactly (initial_stock - successes). Anything else is a real
overselling bug.
"""

import argparse
import json
import uuid
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests


def get_remaining_stock(base_url: str, sku: str, token: str):
    try:
        resp = requests.get(
            f"{base_url}/api/inventory/products/{sku}/",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.json().get("remainingStock")
    except requests.RequestException:
        pass
    return None


def fire_one(base_url, sku, token, idempotency_key, fake_ip):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    if fake_ip:
        # RateLimitMiddleware keys its per-minute bucket off X-Forwarded-For
        # when present. Giving each simulated buyer a distinct IP avoids the
        # shared-loopback rate limit and mirrors how a real flash sale's
        # traffic (many distinct real IPs) actually looks.
        headers["X-Forwarded-For"] = fake_ip

    try:
        resp = requests.post(
            f"{base_url}/api/orders/buy-now/",
            json={"sku": sku, "quantity": 1, "idempotency_key": idempotency_key},
            headers=headers,
            timeout=15,
        )
        return resp.status_code, resp.text
    except requests.RequestException as exc:
        return f"error:{exc}", ""


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--token", required=True, help="a valid JWT access token")
    parser.add_argument("--sku", required=True)
    parser.add_argument("--requests", type=int, default=200, help="total buy attempts to fire")
    parser.add_argument("--workers", type=int, default=50, help="concurrent threads")
    parser.add_argument(
        "--same-idempotency-key",
        action="store_true",
        help="send the SAME idempotency_key on every request to test the double-click/retry race",
    )
    parser.add_argument(
        "--no-spoof-ip",
        action="store_true",
        help="disable X-Forwarded-For spoofing (all requests share the real client IP for rate-limit purposes)",
    )
    args = parser.parse_args()

    shared_key = str(uuid.uuid4()) if args.same_idempotency_key else None
    before_stock = get_remaining_stock(args.base_url, args.sku, args.token)

    print(
        f"Firing {args.requests} concurrent buy-now requests for SKU '{args.sku}' "
        f"({'same idempotency_key on every request' if args.same_idempotency_key else 'unique idempotency_key per request'})\n"
    )

    results = Counter()
    reservation_ids = set()

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = []
        for i in range(args.requests):
            idempotency_key = shared_key or str(uuid.uuid4())
            fake_ip = None if args.no_spoof_ip else f"10.{(i // 65025) % 255}.{(i // 255) % 255}.{i % 255}"
            futures.append(pool.submit(fire_one, args.base_url, args.sku, args.token, idempotency_key, fake_ip))

        for future in as_completed(futures):
            status_code, body = future.result()
            results[status_code] += 1
            if status_code == 201 and body:
                try:
                    reservation_ids.add(json.loads(body)["reservation"]["id"])
                except Exception:
                    pass

    label = {
        201: "Created (reservation won)",
        200: "OK (idempotent replay)",
        409: "Conflict (out of stock)",
        404: "Not found (bad SKU)",
        401: "Unauthorized (bad/missing token)",
        429: "Too Many Requests (rate limited - see --no-spoof-ip / API_RATE_LIMIT)",
        500: "Server error",
    }
    for status_code, count in sorted(results.items(), key=lambda x: str(x[0])):
        print(f"  {status_code}: {count}  {label.get(status_code, '')}")

    successes = results.get(201, 0)
    after_stock = get_remaining_stock(args.base_url, args.sku, args.token)

    print(f"\nInitial stock: {before_stock if before_stock is not None else 'unknown'}")
    print(f"Successful reservations (201): {successes}")
    if args.same_idempotency_key:
        print(f"Unique reservation IDs created: {len(reservation_ids)} (should be 1)")
    print(f"Remaining stock after test: {after_stock if after_stock is not None else 'unknown'}")

    print()
    if args.same_idempotency_key:
        if successes == 1 and len(reservation_ids) <= 1:
            print("PASS: exactly one reservation was created despite N concurrent retries of the same click.")
        else:
            print(
                f"FAIL: idempotency key was not honored under concurrency - "
                f"got {successes} distinct 201s / {len(reservation_ids)} reservation ids (expected 1)."
            )
    elif before_stock is not None and after_stock is not None:
        expected_after = max(0, before_stock - successes)
        if successes <= before_stock and after_stock == expected_after:
            print("PASS: successes <= initial stock, and remaining stock matches exactly. No overselling.")
        elif successes > before_stock:
            print(f"FAIL: OVERSOLD - {successes} successful reservations but only {before_stock} stock was available.")
        else:
            print(
                f"WARNING: successes ({successes}) look fine, but remaining stock ({after_stock}) "
                f"doesn't match expected ({expected_after}) - investigate drift."
            )
    else:
        print("Could not fully verify - check remaining stock manually and compare to the 201 count above.")


if __name__ == "__main__":
    main()
