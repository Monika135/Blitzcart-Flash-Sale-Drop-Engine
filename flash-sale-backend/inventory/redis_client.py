"""
Everything related to the hot, contended stock counter lives here, and
only here. If you ever need to change *how* overselling is prevented
(e.g. swap Redis for something else), this is the only file that changes.

Why Lua scripts: Redis runs a script as a single atomic unit - no other
command can run in the middle of it. That's what makes "check stock,
then decrement" safe under thousands of concurrent requests on the
same key. Doing this as two separate Redis calls (GET then DECR) would
reopen the exact race condition we're trying to close.
"""

import redis
from django.conf import settings

_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
# Public alias used by management commands and other call sites.
redis_client = _client

# Returns 1 = reserved, 0 = not enough stock, -1 = key was never initialized
_DECREMENT_SCRIPT = """
local stock = redis.call('GET', KEYS[1])
if stock == false then
    return -1
end
stock = tonumber(stock)
local qty = tonumber(ARGV[1])
if stock >= qty then
    redis.call('DECRBY', KEYS[1], qty)
    return 1
else
    return 0
end
"""

_INCREMENT_SCRIPT = """
redis.call('INCRBY', KEYS[1], tonumber(ARGV[1]))
return 1
"""

_decrement_stock = _client.register_script(_DECREMENT_SCRIPT)
_increment_stock = _client.register_script(_INCREMENT_SCRIPT)


def _stock_key(sku: str) -> str:
    return f"stock:{sku}"


def init_stock(sku: str, quantity: int) -> None:
    """
    Load the Redis counter from the Postgres source of truth.
    Call this once when a sale window opens (e.g. from a management
    command, an admin action, or on app startup for always-on SKUs).
    """
    _client.set(_stock_key(sku), quantity)


def try_reserve_stock(sku: str, quantity: int = 1) -> bool:
    """
    The atomic check-and-decrement. Returns True if `quantity` units
    were successfully reserved, False if there wasn't enough stock.
    Raises if the SKU was never initialized in Redis (a setup bug,
    not a normal "sold out" case).
    """
    result = _decrement_stock(keys=[_stock_key(sku)], args=[quantity])
    if result == -1:
        raise ValueError(f"Stock for SKU '{sku}' was never initialized in Redis")
    return result == 1


def release_stock(sku: str, quantity: int = 1) -> None:
    """
    Give stock back to the pool. Called when a reservation expires
    or payment fails - this is what makes 'sold out' items reappear
    during a flash sale.
    """
    _increment_stock(keys=[_stock_key(sku)], args=[quantity])


def get_current_stock(sku: str):
    value = _client.get(_stock_key(sku))
    return int(value) if value is not None else None
