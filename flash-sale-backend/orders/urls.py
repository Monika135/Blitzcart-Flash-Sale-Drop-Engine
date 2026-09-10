from django.urls import path

from .views import (
    BuyNowAPIView,
    CancelReservationView,
    InitiatePaymentView,
    PaymentWebhookView,
    VerifyPaymentAPIView,
    ReservationStatusView,
)

urlpatterns = [
    path("buy-now/", BuyNowAPIView.as_view(), name="buy-now"),
    path("reservations/pay/", InitiatePaymentView.as_view(), name="initiate-payment"),
    path(
        "reservations/<uuid:reservation_id>/status/",
        ReservationStatusView.as_view(),
        name="reservation-status",
    ),
    path("reservations/cancel/", CancelReservationView.as_view(), name="cancel-reservation"),
    path("payments/webhook/", PaymentWebhookView.as_view(), name="payment-webhook"),
    path("payments/verify/", VerifyPaymentAPIView.as_view(), name="verify-payment"),
]
