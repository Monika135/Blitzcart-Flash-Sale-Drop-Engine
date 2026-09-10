from django.db import models

# Create your models here.
import uuid

from django.db import models


class Product(models.Model):
    """
    Represents a sellable SKU.

    Durable inventory is stored in Postgres (`total_stock`).
    During an active flash sale, the live inventory counter
    is maintained in Redis for high-concurrency updates.
    """

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        INACTIVE = "INACTIVE", "Inactive"
        OUT_OF_STOCK = "OUT_OF_STOCK", "Out of Stock"

    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    sku = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    image_url = models.URLField(blank=True, null=True, help_text="Product image URL")
    total_stock = models.PositiveIntegerField(
        default=0,
        help_text="Source of truth inventory stored in PostgreSQL."
    )
    sold_count = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )

    is_flash_sale = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "products"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.sku})"