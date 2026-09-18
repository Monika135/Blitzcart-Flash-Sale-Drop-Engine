"""
Fires many concurrent Buy Now requests at one SKU and verifies that the
number of successful reservations never exceeds the stock you initialized.

This is a working replacement for the repo's own scripts/load_test_buy_now.py,
which ships fully commented out.

Setup before running:
    python manage.py init_stock <SKU>          # resets stock to Postgres total_stock
    # or, for a smaller/easier-to-eyeball number:
    redis-cli SET stock:<SKU> 50

Basic usage (simulates N distinct buyers hitting the same SKU at once):
    python load_test_flash_sale.py \
        --base-url http://localhost:8000 \
        --token "$TOKEN" \
        --sku MEN-TSHIRT-BLACK-001 \
        --requests 500 \
        --workers 100

Idempotency-under-race check (same click retried by many threads at once):
    python load_test_flash_sale.py \
        --base-url http://localhost:8000 \
        --token "$TOKEN" \
        --sku MEN-TSHIRT-BLACK-001 \
        --requests 50 \
        --workers 50 \
        --same-idempotency-key

Multiple real user accounts instead of one shared token:
    python load_test_flash_sale.py ... --token-pool tokens.txt   # one JWT per line

Pass criteria (printed at the end):
    count(201) == stock you initialized, and Redis's stock:<sku> ends at
    exactly (initial_stock - successes). Anything else is an overselling bug.
"""

import argparse
import itertools
import sys
import uuid
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests


def get_redis_stock(base_url: str, sku: str, token: str):
    """Best-effort read of live remaining stock via the product-detail API,
    so this script doesn't need direct Redis access to report results."""
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


def fire_one(base_url, sku, token, idempotency_key, spoof_ip, fake_ip):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    if spoof_ip:
        # RateLimitMiddleware keys its per-minute bucket off this header
        # when present. Giving each simulated buyer a distinct IP dodges
        # the shared-loopback rate limit and better mirrors how a real
        # flash sale's traffic (many distinct real IPs) actually looks.
        headers["X-Forwarded-For"] = fake_ip

    try:
        resp = requests.post(
            f"{base_url}/api/orders/buy-now/",
            json={
                "sku": sku,
                "quantity": 1,
                "idempotency_key": idempotency_key,
            },
            headers=headers,
            timeout=15,
        )
        return resp.status_code, resp.text
    except requests.RequestException as exc:
        return f"error:{exc}", ""


def load_token_pool(path):
    with open(path) as f:
        tokens = [line.strip() for line in f if line.strip()]
    if not tokens:
        raise SystemExit(f"--token-pool file '{path}' had no tokens in it")
    return tokens


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--sku", required=True)
    parser.add_argument("--token", help="single JWT access token to use for every request")
    parser.add_argument("--token-pool", help="path to a file with one JWT access token per line, cycled across requests")
    parser.add_argument("--requests", type=int, default=200, help="total buy-now attempts to fire")
    parser.add_argument("--workers", type=int, default=50, help="concurrent threads")
    parser.add_argument(
        "--same-idempotency-key",
        action="store_true",
        help="send the SAME idempotency_key on every request, to test the double-click/retry race instead of distinct-buyer stock contention",
    )
    parser.add_argument(
        "--no-spoof-ip",
        action="store_true",
        help="disable the X-Forwarded-For spoofing (all requests will share the real client IP for rate-limit purposes)",
    )
    parser.add_argument(
        "--initial-stock",
        type=int,
        help="the stock value you initialized before running this (for the pass/fail check). If omitted, the script reads current remaining stock before firing.",
    )
    args = parser.parse_args()

    if not args.token and not args.token_pool:
        raise SystemExit("Provide --token or --token-pool")

    tokens = load_token_pool(args.token_pool) if args.token_pool else [args.token]
    token_cycle = itertools.cycle(tokens)

    shared_key = str(uuid.uuid4()) if args.same_idempotency_key else None

    before_stock = args.initial_stock
    if before_stock is None:
        before_stock = get_redis_stock(args.base_url, args.sku, tokens[0])
        if before_stock is None:
            print(
                "WARNING: couldn't read current remaining stock via the product API "
                "(is the token valid / has init_stock been run?). Pass --initial-stock explicitly.",
                file=sys.stderr,
            )

    print(f"Firing {args.requests} concurrent buy-now requests for SKU '{args.sku}' "
          f"({'same idempotency_key on every request' if args.same_idempotency_key else 'unique idempotency_key per request'})...\n")

    results = Counter()
    reservation_ids = set()

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = []
        for i in range(args.requests):
            token = next(token_cycle)
            idempotency_key = shared_key or str(uuid.uuid4())
            fake_ip = f"10.{(i // 65025) % 255}.{(i // 255) % 255}.{i % 255}"
            futures.append(
                pool.submit(
                    fire_one,
                    args.base_url,
                    args.sku,
                    token,
                    idempotency_key,
                    not args.no_spoof_ip,
                    fake_ip,
                )
            )

        for future in as_completed(futures):
            status_code, body = future.result()
            results[status_code] += 1
            if status_code == 201 and body:
                try:
                    import json

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
    after_stock = get_redis_stock(args.base_url, args.sku, tokens[0])

    print(f"\nInitial stock: {before_stock if before_stock is not None else 'unknown'}")
    print(f"Successful reservations (201): {successes}")
    if args.same_idempotency_key:
        print(f"Unique reservation IDs created: {len(reservation_ids)} (should be 1)")
    print(f"Remaining stock after test: {after_stock if after_stock is not None else 'unknown (check Redis manually)'}")

    print()
    if args.same_idempotency_key:
        if successes == 1 and len(reservation_ids) <= 1:
            print("PASS: exactly one reservation was created despite N concurrent retries of the same click.")
        else:
            print("FAIL: idempotency key was not honored under concurrency - "
                  f"got {successes} distinct 201s / {len(reservation_ids)} reservation ids (expected 1).")
    elif before_stock is not None and after_stock is not None:
        expected_after = max(0, before_stock - successes)
        if successes <= before_stock and after_stock == expected_after:
            print("PASS: successes <= initial stock, and remaining stock matches exactly. No overselling.")
        elif successes > before_stock:
            print(f"FAIL: OVERSOLD - {successes} successful reservations but only {before_stock} stock was available.")
        else:
            print(f"WARNING: successes ({successes}) look fine, but remaining stock "
                  f"({after_stock}) doesn't match expected ({expected_after}) - investigate drift.")
    else:
        print("Could not fully verify (missing before/after stock reading) - re-run with --initial-stock set, "
              "or check `redis-cli GET stock:<sku>` manually and compare to the 201 count above.")


if __name__ == "__main__":
    main()