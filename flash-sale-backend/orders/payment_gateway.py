"""
Razorpay payment gateway integration.

Real gateways don't confirm a charge synchronously in the response to your
API call - they hand you back a "pending" intent (a Razorpay Order) immediately,
then call your webhook URL later with the actual outcome
(payment.captured / order.paid / payment.failed). This module creates that
order and verifies inbound webhook signatures; nothing here fabricates a
result - if Razorpay isn't reachable or isn't configured, this raises instead
of silently pretending the payment succeeded.
"""

import hashlib
import hmac
import logging
import os
from dataclasses import dataclass

from flash_sale_engine.client import client as razorpay_client

logger = logging.getLogger(__name__)


class PaymentGatewayError(Exception):
    """Raised when a real Razorpay call can't be completed (missing config,
    network failure, or an error response from Razorpay itself)."""


@dataclass
class PaymentIntent:
    reference: str
    status: str  # always "pending" the moment it's created


def create_payment_intent(amount, reservation_id: str = "") -> PaymentIntent:
    """
    Starts a charge with Razorpay by creating a Razorpay Order. Requires
    RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET to be configured; raises
    PaymentGatewayError if they aren't, or if Razorpay rejects the call,
    rather than falling back to a fake payment reference.
    """
    key_id = os.environ.get("RAZORPAY_KEY_ID")
    key_secret = os.environ.get("RAZORPAY_KEY_SECRET")

    if not key_id or not key_secret:
        raise PaymentGatewayError(
            "Payment gateway is not configured: RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are missing."
        )

    try:
        # Razorpay expects amount in paise (integer).
        amount_paise = int(round(float(amount) * 100))
        order_data = {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": str(reservation_id),
        }
        order = razorpay_client.order.create(data=order_data)
        return PaymentIntent(reference=order["id"], status="pending")
    except Exception as exc:
        logger.error("Razorpay order creation failed: %s", exc)
        raise PaymentGatewayError(f"Could not create payment order with Razorpay: {exc}") from exc


def verify_webhook_signature(payload_bytes: bytes, signature: str) -> bool:
    """
    Verifies an inbound Razorpay webhook using RAZORPAY_WEBHOOK_SECRET
    (the secret you configure alongside the webhook URL in the Razorpay
    dashboard). Returns False (never raises) for any missing/invalid input
    so callers can treat it as a simple pass/fail check.
    """
    if not signature:
        return False

    secret = os.environ.get("RAZORPAY_WEBHOOK_SECRET")
    if not secret:
        logger.error("RAZORPAY_WEBHOOK_SECRET is not configured - cannot verify webhook signatures.")
        return False

    expected = hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)

def verify_payment_signature(razorpay_order_id: str, razorpay_payment_id: str, razorpay_signature: str) -> bool:
    """
    Verifies a Razorpay payment signature returned by the client-side checkout modal.
    Matches Razorpay signature format: HMAC_SHA256(order_id + "|" + payment_id, secret) == signature
    """
    if not (razorpay_order_id and razorpay_payment_id and razorpay_signature):
        return False

    secret = os.environ.get("RAZORPAY_KEY_SECRET")
    if not secret:
        logger.error("RAZORPAY_KEY_SECRET is not configured - cannot verify payment signature.")
        return False

    msg = f"{razorpay_order_id}|{razorpay_payment_id}".encode("utf-8")
    expected = hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, razorpay_signature)

