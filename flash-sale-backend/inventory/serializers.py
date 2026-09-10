from rest_framework import serializers

from .models import Product


class ProductSerializer(serializers.ModelSerializer):
    """
    `remainingStock` is the fast, hot-path number from Redis (falls back
    to the durable Postgres count if the sale hasn't been initialised
    into Redis yet via `init_stock`, so the page still renders sensibly
    in that case rather than showing nothing).
    """

    id = serializers.CharField(source="sku")
    subtitle = serializers.CharField(source="description")
    price = serializers.SerializerMethodField()
    totalStock = serializers.IntegerField(source="total_stock")
    remainingStock = serializers.SerializerMethodField()
    # viewersLive = serializers.SerializerMethodField()
    imageUrl = serializers.CharField(source="image_url")

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "subtitle",
            "price",
            "totalStock",
            "remainingStock",
            # "viewersLive",
            "imageUrl",
            "status",
        ]

    def get_price(self, obj):
        return int(obj.price)

    def get_remainingStock(self, obj):
        live_stocks = self.context.get("live_stocks")
        if live_stocks and obj.sku in live_stocks:
            live_stock = live_stocks[obj.sku]
            if live_stock is not None:
                return max(0, live_stock)

        live_stock = self.context.get("live_stock")
        if live_stock is not None:
            return max(0, live_stock)
        return obj.total_stock - obj.sold_count

    # def get_viewersLive(self, obj):
    #     # No real analytics pipeline behind this yet - it's a cosmetic
    #     # "social proof" number the frontend already expected. Derived
    #     # deterministically from remaining stock so it moves believably
    #     # instead of being random noise on every poll.
    #     remaining = self.get_remainingStock(obj)
    #     return max(15, min(900, remaining * 9 + 40))
