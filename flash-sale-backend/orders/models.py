import uuid

from django.db import models
from django.utils import timezone

from inventory.models import Product


class Reservation(models.Model):
    """
    Created the instant a Buy Now request wins its Redis stock check.
    It is NOT a confirmed sale - it's a short-lived hold that becomes
    an Order if payment succeeds, or is released back to stock if
    payment fails or the TTL expires.
    """

    STATUS_PENDING = "pending"
    STATUS_CONFIRMED = "confirmed"
    STATUS_EXPIRED = "expired"
    STATUS_CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending payment"),
        (STATUS_CONFIRMED, "Confirmed"),
        (STATUS_EXPIRED, "Expired"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="reservations")
    user_id = models.CharField(max_length=100)
    quantity = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)

    # The client generates this once, at the moment the user taps "Buy".
    # Retried/duplicate requests carry the same key, which is how we
    # avoid double-reserving stock on network retries.
    idempotency_key = models.CharField(max_length=100, unique=True)

    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        indexes = [
            models.Index(fields=["status", "expires_at"]),
        ]

    def is_expired(self) -> bool:
        return self.status == self.STATUS_PENDING and timezone.now() > self.expires_at

    def __str__(self):
        return f"Reservation {self.id} - {self.product.sku} x{self.quantity} ({self.status})"


class Order(models.Model):
    """
    Created only after payment succeeds. This is the durable, confirmed
    record - the thing that actually gets fulfilled and shipped.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reservation = models.OneToOneField(Reservation, on_delete=models.PROTECT, related_name="order")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="orders")
    user_id = models.CharField(max_length=100)
    quantity = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Order {self.id} - {self.product.sku} x{self.quantity}"


class Payment(models.Model):
    """
    One row per charge attempt against a Reservation. A reservation can
    have more than one attempt (e.g. first card declined, user retries
    with a different card before the TTL expires).
    """

    STATUS_PENDING = "pending"
    STATUS_SUCCESS = "success"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_SUCCESS, "Success"),
        (STATUS_FAILED, "Failed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reservation = models.ForeignKey(Reservation, on_delete=models.PROTECT, related_name="payment_attempts")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    gateway_reference = models.CharField(max_length=100, blank=True)
    failure_reason = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Payment {self.id} - {self.status} ({self.reservation_id})"


class WebhookEvent(models.Model):
    """
    One row per webhook event we've processed. Gateways retry webhook
    delivery until they get a fast 2xx response, so the same event can
    arrive more than once. Recording event_id here is what stops a
    retried "payment succeeded" event from creating a second Order.
    """

    event_id = models.CharField(max_length=100, unique=True, primary_key=True)
    received_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.event_id