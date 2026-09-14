import json
import logging

from django.db import transaction
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from inventory.redis_client import release_stock

from .models import Order, Payment, Reservation, WebhookEvent
from .payment_gateway import PaymentGatewayError, create_payment_intent, verify_webhook_signature, verify_payment_signature
from .serializers import (
    BuyNowRequestSerializer,
    InitiatePaymentRequestSerializer,
    OrderSerializer,
)
from .services import OutOfStockError, ProductNotFoundError, build_buy_now_response, confirm_payment_and_create_order

logger = logging.getLogger(__name__)


class BuyNowAPIView(APIView):
    """
    POST /api/orders/buy-now/

    Body:
        {
            "sku": "AJ1-BRED-10",
            "quantity": 1,
            "idempotency_key": "a client-generated uuid, same value on retries"
        }

    The view stays thin: it validates the payload, delegates the
    business rules to services, and formats the API response.
    """

    def post(self, request):
        payload = BuyNowRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        try:
            response_data = build_buy_now_response(request, payload.validated_data)
            return Response(
                {
                    "success": True,
                    **response_data,
                },
                status=status.HTTP_200_OK if response_data["replayed"] else status.HTTP_201_CREATED,
            )
        except (ProductNotFoundError, OutOfStockError) as exc:
            status_code = status.HTTP_404_NOT_FOUND if isinstance(exc, ProductNotFoundError) else status.HTTP_409_CONFLICT
            return Response({"success": False, "error": str(exc)}, status=status_code)


class InitiatePaymentView(APIView):
    """
    POST /api/orders/reservations/pay/
    Body: { "reservation_id": "<uuid>" }

    Creates a real Razorpay order and returns immediately with a 202 - this
    does NOT confirm the order. Razorpay confirms or rejects it later,
    asynchronously, by calling PaymentWebhookView once the customer completes
    (or abandons/fails) checkout on the frontend. Poll ReservationStatusView
    (or wait for your own push notification) to find out the outcome.
    """

    def post(self, request):
        payload = InitiatePaymentRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        reservation_id = payload.validated_data["reservation_id"]

        try:
            reservation = Reservation.objects.select_related("product").get(id=reservation_id)
        except Reservation.DoesNotExist:
            return Response({"error": "Reservation not found"}, status=status.HTTP_404_NOT_FOUND)

        if reservation.status == Reservation.STATUS_CONFIRMED:
            return Response(
                {**OrderSerializer(reservation.order).data, "replayed": True},
                status=status.HTTP_200_OK,
            )

        if reservation.status != Reservation.STATUS_PENDING:
            return Response(
                {"error": f"Reservation is '{reservation.status}', cannot pay"},
                status=status.HTTP_409_CONFLICT,
            )

        if reservation.is_expired():
            release_stock(reservation.product.sku, reservation.quantity)
            reservation.status = Reservation.STATUS_EXPIRED
            reservation.save(update_fields=["status"])
            return Response({"error": "Reservation expired"}, status=status.HTTP_410_GONE)

        # Don't start a second payment intent if one is already in
        # flight for this reservation - return the existing one instead.
        existing_pending = reservation.payment_attempts.filter(status=Payment.STATUS_PENDING).first()
        if existing_pending:
            return Response(
                {
                    "payment_reference": existing_pending.gateway_reference,
                    "status": "processing",
                    "replayed": True,
                },
                status=status.HTTP_202_ACCEPTED,
            )

        amount = reservation.product.price * reservation.quantity
        try:
            intent = create_payment_intent(amount, reservation_id=str(reservation.id))
        except PaymentGatewayError as exc:
            logger.error("Payment intent creation failed for reservation %s: %s", reservation.id, exc)
            return Response(
                {"error": "Payment gateway is currently unavailable. Please try again shortly."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        Payment.objects.create(
            reservation=reservation,
            amount=amount,
            status=Payment.STATUS_PENDING,
            gateway_reference=intent.reference,
        )

        return Response(
            {"payment_reference": intent.reference, "status": "processing", "replayed": False},
            status=status.HTTP_202_ACCEPTED,
        )


class PaymentWebhookView(APIView):
    """
    POST /api/orders/payments/webhook/

    Receives Razorpay webhook events. Configure this exact URL (behind a
    publicly reachable host, e.g. via ngrok in dev) as the webhook endpoint
    in the Razorpay dashboard, with the same secret as RAZORPAY_WEBHOOK_SECRET.
    """

    authentication_classes = []
    permission_classes = []

    def post(self, request):
        raw_body = request.body
        signature = request.headers.get("X-Razorpay-Signature")

        if not verify_webhook_signature(raw_body, signature):
            print("Rejected webhook call with an invalid/missing signature.")
            return Response({"error": "Invalid signature"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            event = json.loads(raw_body)
        except json.JSONDecodeError:
            return Response({"error": "Invalid JSON"}, status=status.HTTP_400_BAD_REQUEST)

        event_id = event.get("id") or request.headers.get("X-Razorpay-Event-Id")
        rzp_event = event.get("event", "")

        if rzp_event == "payment.authorized":
            # Authorization is not capture. Keep the reservation pending and
            # acknowledge the event so Razorpay does not retry it.
            return Response({"status": "payment authorized; awaiting capture"}, status=status.HTTP_200_OK)
        if rzp_event in ("payment.captured", "order.paid"):
            event_type = "payment.succeeded"
        elif rzp_event == "payment.failed":
            event_type = "payment.failed"
        else:
            event_type = rzp_event

        payment_entity = event.get("payload", {}).get("payment", {}).get("entity", {})
        reference = payment_entity.get("order_id")
        failure_reason = payment_entity.get("error_description", "")

        if not event_id or not event_type or not reference:
            return Response({"error": "Missing required fields"}, status=status.HTTP_400_BAD_REQUEST)

        # Dedup: Razorpay retries this exact call until it gets a 2xx.
        # Without this, a retried "captured" event would try to create a
        # second Order for the same payment.
        _, created = WebhookEvent.objects.get_or_create(event_id=event_id)
        if not created:
            return Response({"status": "already processed"}, status=status.HTTP_200_OK)

        try:
            payment = Payment.objects.select_related("reservation", "reservation__product").get(
                gateway_reference=reference
            )
        except Payment.DoesNotExist:
            return Response({"error": "Unknown payment reference"}, status=status.HTTP_404_NOT_FOUND)

        reservation = payment.reservation

        # Already confirmed - a second event about the same order.
        if reservation.status == Reservation.STATUS_CONFIRMED:
            order_id = str(reservation.order.id) if hasattr(reservation, "order") else ""
            return Response({"status": "already resolved", "order_id": order_id}, status=status.HTTP_200_OK)

        if event_type == "payment.succeeded":
            order = confirm_payment_and_create_order(payment)
            return Response(
                {"status": "order confirmed", "order_id": str(order.id)}, status=status.HTTP_200_OK
            )

        if event_type == "payment.failed":
            # Record failed attempt details
            payment.status = Payment.STATUS_FAILED
            payment.failure_reason = failure_reason or ""
            payment.save(update_fields=["status", "failure_reason"])

            # Only release stock if reservation has expired.
            # While within the TTL, the customer may retry payment in the modal.
            if reservation.is_expired():
                release_stock(reservation.product.sku, reservation.quantity)
                reservation.status = Reservation.STATUS_EXPIRED
                reservation.save(update_fields=["status"])

            return Response({"status": "payment attempt failed"}, status=status.HTTP_200_OK)

        return Response({"error": f"Unknown event type '{event_type}'"}, status=status.HTTP_400_BAD_REQUEST)


class ReservationStatusView(APIView):
    """
    GET /api/orders/reservations/<reservation_id>/status/

    For the client to poll while waiting on the webhook to land (or
    to check back after a push notification / websocket event fires).
    """

    def get(self, request, reservation_id):
        try:
            reservation = Reservation.objects.get(id=reservation_id)
        except Reservation.DoesNotExist:
            return Response(
                {
                    "message": "Reservation not found",
                    "data": None,
                    "status": "error",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        body = {"reservation_id": str(reservation.id), "status": reservation.status}
        if reservation.status == Reservation.STATUS_CONFIRMED:
            body["order_id"] = str(reservation.order.id)
        return Response(
            {
                "message": "Reservation status retrieved successfully",
                "data": body,
                "status": "success",
            },
            status=status.HTTP_200_OK,
        )


class CancelReservationView(APIView):
    """
    POST /api/orders/reservations/cancel/
    Body: { "reservation_id": "<uuid>" }

    User-initiated abandonment (e.g. closes the checkout tab). Blocked
    while a payment intent is actually in flight - we can't safely
    release the stock while the gateway might still call back with a
    "succeeded" event for it.
    """

    def post(self, request):
        reservation_id = request.data.get("reservation_id")
        if not reservation_id:
            return Response({"error": "reservation_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            reservation = Reservation.objects.select_related("product").get(id=reservation_id)
        except (Reservation.DoesNotExist, ValueError, TypeError):
            return Response({"error": "Reservation not found"}, status=status.HTTP_404_NOT_FOUND)

        if reservation.status != Reservation.STATUS_PENDING:
            return Response(
                {"error": f"Reservation is '{reservation.status}', cannot cancel"},
                status=status.HTTP_409_CONFLICT,
            )

        if reservation.payment_attempts.filter(status=Payment.STATUS_PENDING).exists():
            return Response(
                {"error": "A payment is currently in progress for this reservation"},
                status=status.HTTP_409_CONFLICT,
            )

        release_stock(reservation.product.sku, reservation.quantity)
        reservation.status = Reservation.STATUS_CANCELLED
        reservation.save(update_fields=["status"])

        return Response(
            {"reservation_id": str(reservation.id), "status": reservation.status},
            status=status.HTTP_200_OK,
        )


class VerifyPaymentAPIView(APIView):
    """
    POST /api/orders/payments/verify/
    Body:
        {
            "reservation_id": "<uuid>",
            "razorpay_order_id": "order_xxx",
            "razorpay_payment_id": "pay_xxx",
            "razorpay_signature": "signature_xxx"
        }
    """

    authentication_classes = []
    permission_classes = []

    def post(self, request):
        razorpay_order_id = request.data.get("razorpay_order_id")
        razorpay_payment_id = request.data.get("razorpay_payment_id")
        razorpay_signature = request.data.get("razorpay_signature")
        reservation_id = request.data.get("reservation_id")

        if not (razorpay_order_id and razorpay_payment_id and razorpay_signature):
            return Response(
                {"error": "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not verify_payment_signature(razorpay_order_id, razorpay_payment_id, razorpay_signature):
            logger.warning("Invalid payment signature received for order %s", razorpay_order_id)
            return Response({"error": "Invalid payment signature"}, status=status.HTTP_400_BAD_REQUEST)

        payment = None
        if razorpay_order_id:
            payment = Payment.objects.select_related("reservation", "reservation__product").filter(
                gateway_reference=razorpay_order_id
            ).first()

        if not payment and reservation_id:
            try:
                payment = Payment.objects.select_related("reservation", "reservation__product").filter(
                    reservation_id=reservation_id
                ).first()
            except Exception:
                pass

        if not payment:
            return Response({"error": "Payment record not found"}, status=status.HTTP_404_NOT_FOUND)

        order = confirm_payment_and_create_order(payment)
        return Response(
            {"status": "order confirmed", "order_id": str(order.id)},
            status=status.HTTP_200_OK,
        )

