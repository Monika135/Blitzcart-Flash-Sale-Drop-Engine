from datetime import timedelta

from django.db import IntegrityError
from django.utils import timezone

from inventory.models import Product
from inventory.redis_client import release_stock, try_reserve_stock

from .models import Reservation
from .serializers import ReservationSerializer

RESERVATION_TTL_MINUTES = 10


def resolve_user_id(request) -> str:
    if request.user.is_authenticated:
        return str(request.user.id)
    # Replace with real auth. Kept simple here so the flow is easy to test.
    return str(request.data.get("user_id", "guest"))


def create_buy_now_reservation(*, sku: str, quantity: int, idempotency_key: str, user_id: str) -> tuple[Reservation, bool]:
    """
    Encapsulates the flash-sale reservation workflow.

    The view validates the payload and renders the response. This service
    owns the business rules: idempotency, stock reservation, and durable
    reservation creation.
    """

    existing = Reservation.objects.filter(idempotency_key=idempotency_key).first()
    if existing:
        return existing, True

    try:
        product = Product.objects.get(sku=sku)
    except Product.DoesNotExist as exc:
        raise ProductNotFoundError(f"Product not found for SKU '{sku}'") from exc

    reserved = try_reserve_stock(sku, quantity)
    if not reserved:
        raise OutOfStockError("Out of stock")

    try:
        reservation = Reservation.objects.create(
            product=product,
            user_id=user_id,
            quantity=quantity,
            idempotency_key=idempotency_key,
            expires_at=timezone.now() + timedelta(minutes=RESERVATION_TTL_MINUTES),
        )
    except IntegrityError:
        # Extremely rare: two requests with the same idempotency_key
        # both passed the check in step 1 (raced each other there).
        # Give back the stock we just took and return the winner's reservation.
        release_stock(sku, quantity)
        return Reservation.objects.get(idempotency_key=idempotency_key), True
    except Exception:
        release_stock(sku, quantity)
        raise

    return reservation, False


def build_buy_now_response(request, validated_data: dict) -> dict:
    reservation, replayed = create_buy_now_reservation(
        sku=validated_data["sku"],
        quantity=validated_data["quantity"],
        idempotency_key=validated_data["idempotency_key"],
        user_id=resolve_user_id(request),
    )

    return {
        "reservation": ReservationSerializer(reservation).data,
        "replayed": replayed,
    }


class OutOfStockError(Exception):
    pass


class ProductNotFoundError(Exception):
    pass

from django.db import transaction
from .models import Order, Payment


def confirm_payment_and_create_order(payment: Payment) -> Order:
    """
    Atomically transitions a payment to SUCCESS and confirms the reservation into an Order.
    Handles idempotent repeats and revives reservations if prematurely cancelled.
    """
    with transaction.atomic():
        reservation = payment.reservation

        # Check if already confirmed
        if hasattr(reservation, "order"):
            return reservation.order

        existing_order = Order.objects.filter(reservation=reservation).first()
        if existing_order:
            return existing_order

        # If reservation was marked cancelled due to an earlier failed attempt:
        if reservation.status == Reservation.STATUS_CANCELLED:
            # Re-reserve the stock so inventory accounting matches reality
            try_reserve_stock(reservation.product.sku, reservation.quantity)

        payment.status = Payment.STATUS_SUCCESS
        payment.save(update_fields=["status"])

        order = Order.objects.create(
            reservation=reservation,
            product=reservation.product,
            user_id=reservation.user_id,
            quantity=reservation.quantity,
        )
        reservation.status = Reservation.STATUS_CONFIRMED
        reservation.save(update_fields=["status"])
        return order

