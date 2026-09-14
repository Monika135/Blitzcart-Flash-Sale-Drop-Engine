from rest_framework import serializers

from .models import Order, Reservation


class BuyNowRequestSerializer(serializers.Serializer):
    """Validates the incoming Buy Now click."""

    sku = serializers.CharField(max_length=50)
    quantity = serializers.IntegerField(min_value=1, default=1)
    # Generated once on the client at the moment of the click, e.g. a UUID.
    # Sent unchanged on any retry of the same click.
    idempotency_key = serializers.CharField(max_length=100)


class ReservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reservation
        fields = ["id", "product", "quantity", "status", "created_at", "expires_at"]


class InitiatePaymentRequestSerializer(serializers.Serializer):
    """What the client sends to start paying for a reservation. Razorpay's
    Checkout SDK collects the actual card/UPI/wallet details client-side
    against the order this creates - the backend never sees or needs a
    card token."""

    reservation_id = serializers.UUIDField()


class OrderSerializer(serializers.ModelSerializer):
    order_id = serializers.UUIDField(source="id", read_only=True)

    class Meta:
        model = Order
        fields = ["order_id", "product", "user_id", "quantity", "created_at"]
