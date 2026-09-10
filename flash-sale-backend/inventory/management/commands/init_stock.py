from django.core.management.base import BaseCommand, CommandError
from inventory.models import Product
from inventory.redis_client import redis_client


class Command(BaseCommand):
    help = "Initialise product stock counters in Redis"

    def add_arguments(self, parser):
        parser.add_argument(
            "skus",
            nargs="*",
            type=str,
            help="One or more product SKUs",
        )

        parser.add_argument(
            "--all",
            action="store_true",
            dest="load_all",
            help="Load stock for all products",
        )

    def handle(self, *args, **options):
        skus = options["skus"]
        load_all = options["load_all"]

        if load_all and skus:
            raise CommandError("Use either SKU values or --all, not both.")

        if load_all:
            products = Product.objects.all()
        elif skus:
            products = Product.objects.filter(sku__in=skus)

            found_skus = set(products.values_list("sku", flat=True))
            missing_skus = set(skus) - found_skus

            if missing_skus:
                self.stdout.write(
                    self.style.WARNING(
                        f"Products not found: {', '.join(sorted(missing_skus))}"
                    )
                )
        else:
            raise CommandError(
                "Provide at least one SKU or use the --all option."
            )

        products = list(products)

        if not products:
            raise CommandError("No products found to initialise.")

        # Pipeline executes all Redis SET operations in one network request.
        pipeline = redis_client.pipeline(transaction=True)

        for product in products:
            redis_key = f"stock:{product.sku}"
            pipeline.set(redis_key, product.total_stock)

        pipeline.execute()

        self.stdout.write(
            self.style.SUCCESS(
                f"Loaded stock for {len(products)} product(s) into Redis."
            )
        )

        for product in products:
            self.stdout.write(
                f"stock:{product.sku} = {product.total_stock}"
            )