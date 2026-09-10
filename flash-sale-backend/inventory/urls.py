from django.urls import path

from .views import ProductDetailView, ProductListView

urlpatterns = [
    path("products/", ProductListView.as_view(), name="product-list"),
    path("products/<str:sku>/", ProductDetailView.as_view(), name="product-detail"),
]
