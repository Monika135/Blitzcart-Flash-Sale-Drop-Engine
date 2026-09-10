from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Product
from .redis_client import get_current_stock, redis_client
from .serializers import ProductSerializer


class ProductDetailView(APIView):
    """
    GET /api/inventory/products/<sku>/

    This is the endpoint ProductPage polls for live stock. Didn't exist
    in the original backend at all - Product had a model but no API
    surface, so there was nothing for the frontend to actually talk to.
    """

    def get(self, request, sku):
        try:
            product = Product.objects.get(sku=sku)
        except Product.DoesNotExist:
            return Response({"error": "Product not found"}, status=status.HTTP_404_NOT_FOUND)

        live_stock = get_current_stock(product.sku)
        serializer = ProductSerializer(product, context={"live_stock": live_stock})
        return Response(serializer.data, status=status.HTTP_200_OK)


class ProductListView(APIView):
    """
    GET /api/inventory/products/

    Returns all active products. If products have active stock in Redis,
    uses those; otherwise falls back to Postgres.
    """

    def get(self, request):
        # Retrieve all keys from Redis with the pattern 'stock:*'
        keys = redis_client.keys("stock:*")

        if keys:
            skus = [key.split(":", 1)[1] for key in keys]
            products = Product.objects.filter(sku__in=skus, status=Product.Status.ACTIVE)

            # Batch fetch stocks using MGET
            stock_values = redis_client.mget(keys)
            live_stocks = {}
            for key, val in zip(keys, stock_values):
                sku = key.split(":", 1)[1]
                live_stocks[sku] = int(val) if val is not None else None

            serializer = ProductSerializer(
                products,
                many=True,
                context={"live_stocks": live_stocks}
            )
        else:
            # Fall back to all active products in Postgres
            products = Product.objects.filter(status=Product.Status.ACTIVE)
            serializer = ProductSerializer(
                products,
                many=True
            )

        return Response({
            "message": "Active products retrieved successfully",
            "data": serializer.data,
            "status": "success",
        },
            status=status.HTTP_200_OK)
