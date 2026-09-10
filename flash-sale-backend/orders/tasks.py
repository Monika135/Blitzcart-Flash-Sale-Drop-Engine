"""
Run this on a schedule via Celery Beat (e.g. every 30 seconds) so
abandoned reservations - payment never started, or failed - don't
lock up stock forever. This is what makes 'sold out' items reappear
minutes into a flash sale.
"""

from celery import shared_task
from django.utils import timezone

from inventory.redis_client import release_stock

from .models import Reservation


@shared_task
def expire_stale_reservations():
    stale = Reservation.objects.select_related("product").filter(
        status=Reservation.STATUS_PENDING,
        expires_at__lt=timezone.now(),
    )

    expired_count = 0
    for reservation in stale:
        release_stock(reservation.product.sku, reservation.quantity)
        reservation.status = Reservation.STATUS_EXPIRED
        reservation.save(update_fields=["status"])
        expired_count += 1

    return expired_count
