from inventory.models import Product
from django.core.management.base import BaseCommand


products = [
    # =========================
    # MEN'S CLOTHING
    # =========================

    {
        "sku": "MEN-TSHIRT-BLACK-001",
        "name": "Classic Black Cotton T-Shirt",
        "description": "Premium regular-fit cotton t-shirt for everyday wear.",
        "price": 799.00,
        "image_url": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800",
        "total_stock": 120,
        "sold_count": 0,
        "status": "ACTIVE",
        "is_flash_sale": True,
    },
    {
        "sku": "MEN-HOODIE-GREY-002",
        "name": "Oversized Grey Hoodie",
        "description": "Comfortable oversized hoodie with a soft fleece interior.",
        "price": 1499.00,
        "image_url": "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800",
        "total_stock": 80,
        "sold_count": 0,
        "status": "ACTIVE",
        "is_flash_sale": True,
    },
    {
        "sku": "MEN-SHIRT-WHITE-003",
        "name": "Premium White Casual Shirt",
        "description": "Smart casual full-sleeve shirt made from lightweight fabric.",
        "price": 1299.00,
        "image_url": "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800",
        "total_stock": 65,
        "sold_count": 0,
        "status": "ACTIVE",
        "is_flash_sale": True,
    },
    {
        "sku": "MEN-JEANS-BLUE-004",
        "name": "Slim Fit Blue Jeans",
        "description": "Classic slim-fit denim jeans with stretch comfort.",
        "price": 1899.00,
        "image_url": "https://images.unsplash.com/photo-1542272604-787c3835535d?w=800",
        "total_stock": 90,
        "sold_count": 0,
        "status": "ACTIVE",
        "is_flash_sale": True,
    },
    {
        "sku": "MEN-JACKET-BLACK-005",
        "name": "Urban Black Denim Jacket",
        "description": "Classic denim jacket designed for casual streetwear looks.",
        "price": 2499.00,
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800",
        "total_stock": 45,
        "sold_count": 0,
        "status": "ACTIVE",
        "is_flash_sale": True,
    },

    # =========================
    # WOMEN'S CLOTHING
    # =========================

    {
        "sku": "WOMEN-DRESS-FLORAL-006",
        "name": "Floral Summer Dress",
        "description": "Lightweight floral dress perfect for summer and casual outings.",
        "price": 1799.00,
        "image_url": "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800",
        "total_stock": 70,
        "sold_count": 0,
        "status": "ACTIVE",
        "is_flash_sale": True,
    },
    {
        "sku": "WOMEN-TOP-WHITE-007",
        "name": "White Casual Crop Top",
        "description": "Minimal white crop top with a comfortable modern fit.",
        "price": 699.00,
        "image_url": "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=800",
        "total_stock": 110,
        "sold_count": 0,
        "status": "ACTIVE",
        "is_flash_sale": True,
    },
    {
        "sku": "WOMEN-JEANS-BLUE-008",
        "name": "High-Waist Blue Jeans",
        "description": "Stylish high-waist denim jeans with a comfortable stretch fit.",
        "price": 1999.00,
        "image_url": "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800",
        "total_stock": 85,
        "sold_count": 0,
        "status": "ACTIVE",
        "is_flash_sale": True,
    },
    {
        "sku": "WOMEN-HOODIE-BEIGE-009",
        "name": "Relaxed Beige Hoodie",
        "description": "Soft oversized hoodie in a neutral beige tone.",
        "price": 1599.00,
        "image_url": "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800",
        "total_stock": 60,
        "sold_count": 0,
        "status": "ACTIVE",
        "is_flash_sale": True,
    },
    {
        "sku": "WOMEN-JACKET-BROWN-010",
        "name": "Classic Brown Leather Jacket",
        "description": "Stylish leather-look jacket for a timeless streetwear appearance.",
        "price": 2999.00,
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800",
        "total_stock": 35,
        "sold_count": 0,
        "status": "ACTIVE",
        "is_flash_sale": True,
    },

    # =========================
    # SHOES
    # =========================

    {
        "sku": "SHOE-SNEAKER-WHITE-011",
        "name": "Classic White Sneakers",
        "description": "Minimal white sneakers suitable for everyday casual outfits.",
        "price": 2299.00,
        "image_url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800",
        "total_stock": 100,
        "sold_count": 0,
        "status": "ACTIVE",
        "is_flash_sale": True,
    },
    {
        "sku": "SHOE-RUNNING-BLACK-012",
        "name": "Performance Running Shoes",
        "description": "Lightweight running shoes with cushioned soles for daily workouts.",
        "price": 2799.00,
        "image_url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800",
        "total_stock": 75,
        "sold_count": 0,
        "status": "ACTIVE",
        "is_flash_sale": True,
    },
    {
        "sku": "SHOE-HIGH-TOP-RED-013",
        "name": "High-Top Street Sneakers",
        "description": "Bold high-top sneakers inspired by modern streetwear.",
        "price": 3199.00,
        "image_url": "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=800",
        "total_stock": 55,
        "sold_count": 0,
        "status": "ACTIVE",
        "is_flash_sale": True,
    },
    {
        "sku": "SHOE-WOMEN-HEELS-014",
        "name": "Elegant Black Heels",
        "description": "Classic black heels designed for parties and special occasions.",
        "price": 2499.00,
        "image_url": "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800",
        "total_stock": 40,
        "sold_count": 0,
        "status": "ACTIVE",
        "is_flash_sale": True,
    },
    {
        "sku": "SHOE-WOMEN-SANDAL-015",
        "name": "Minimal Strappy Sandals",
        "description": "Elegant strappy sandals with a comfortable everyday design.",
        "price": 1299.00,
        "image_url": "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800",
        "total_stock": 95,
        "sold_count": 0,
        "status": "ACTIVE",
        "is_flash_sale": True,
    },

    # =========================
    # ACCESSORIES
    # =========================

    {
        "sku": "ACC-BACKPACK-BLACK-016",
        "name": "Urban Black Backpack",
        "description": "Spacious everyday backpack suitable for work, college and travel.",
        "price": 1599.00,
        "image_url": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800",
        "total_stock": 80,
        "sold_count": 0,
        "status": "ACTIVE",
        "is_flash_sale": True,
    },
    {
        "sku": "ACC-SUNGLASSES-017",
        "name": "Classic Black Sunglasses",
        "description": "Timeless black sunglasses with a modern frame.",
        "price": 999.00,
        "image_url": "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800",
        "total_stock": 150,
        "sold_count": 0,
        "status": "ACTIVE",
        "is_flash_sale": True,
    },
    {
        "sku": "ACC-WATCH-BLACK-018",
        "name": "Minimal Black Wrist Watch",
        "description": "Minimal analog wrist watch with a clean modern dial.",
        "price": 2199.00,
        "image_url": "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800",
        "total_stock": 50,
        "sold_count": 0,
        "status": "ACTIVE",
        "is_flash_sale": True,
    },
    {
        "sku": "ACC-CAP-BLACK-019",
        "name": "Classic Black Baseball Cap",
        "description": "Adjustable cotton baseball cap for everyday casual wear.",
        "price": 599.00,
        "image_url": "https://images.unsplash.com/photo-1521369909029-2afed882baee?w=800",
        "total_stock": 130,
        "sold_count": 0,
        "status": "ACTIVE",
        "is_flash_sale": True,
    },
    {
        "sku": "ACC-WALLET-BROWN-020",
        "name": "Premium Brown Leather Wallet",
        "description": "Compact leather wallet with multiple card and cash compartments.",
        "price": 1199.00,
        "image_url": "https://images.unsplash.com/photo-1627123424574-724758594e93?w=800",
        "total_stock": 100,
        "sold_count": 0,
        "status": "ACTIVE",
        "is_flash_sale": True,
    },
]


class Command(BaseCommand):
    help = "Seed the database with sample products"

    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0

        for product_data in products:
            sku = product_data["sku"]
            _, created = Product.objects.update_or_create(
                sku=sku,
                defaults=product_data,
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {created_count} new products and "
                f"updated {updated_count} existing products successfully."
            )
        )