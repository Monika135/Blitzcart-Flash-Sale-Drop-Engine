import json
import time
from django.http import JsonResponse
from django.contrib.auth.models import User
from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from .jwt_utils import decode_token
from inventory.redis_client import redis_client

class JWTAuthMiddleware:
    """
    Django middleware to authenticate requests using a custom JWT token.
    Enforces authentication for all requests under /api/inventory/ and /api/orders/.
    Excludes the payment webhook under /api/orders/payments/webhook/.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        
        # Enforce authentication on /api/inventory/ and /api/orders/
        # Check if the path starts with these protected prefixes
        is_protected = path.startswith('/api/inventory/') or path.startswith('/api/orders/')
        
        # Exclude webhook endpoint
        if path in ('/api/orders/payments/webhook/', '/api/orders/payments/verify/'):
            is_protected = False

        auth_header = request.headers.get('Authorization')
        user = None

        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            payload = decode_token(token, expected_token_type='access')
            if payload:
                user_id = payload.get('user_id')
                try:
                    user = User.objects.get(id=user_id)
                except User.DoesNotExist:
                    pass

        if user:
            request.user = user

        if is_protected:
            if not user or not user.is_authenticated:
                return JsonResponse(
                    {'error': 'Authentication credentials were not provided or are invalid'},
                    status=401
                )

        return self.get_response(request)


class RateLimitMiddleware:
    """
    Django middleware that implements rate limiting using Redis.
    Limits request rates for all endpoints starting with /api/.
    """
    def __init__(self, get_response):
        self.get_response = get_response
        self.rate_limit = getattr(settings, 'API_RATE_LIMIT', 100)  # 100 requests per minute
        self.window = 60  # 60 seconds

    def __call__(self, request):
        if not request.path.startswith('/api/'):
            return self.get_response(request)

        # Get client IP address
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')

        current_time = int(time.time())
        window_bucket = current_time // self.window
        redis_key = f"ratelimit:{ip}:{window_bucket}"

        try:
            pipe = redis_client.pipeline()
            pipe.incr(redis_key)
            pipe.expire(redis_key, self.window + 10)
            results = pipe.execute()
            
            request_count = results[0]
            if request_count > self.rate_limit:
                return JsonResponse(
                    {'error': 'Too many requests. Please try again later.'},
                    status=429
                )
        except Exception:
            # Fail open if Redis is unavailable or fails
            pass

        return self.get_response(request)


class MiddlewareAuthentication(BaseAuthentication):
    """
    Bridges Django's middleware-based authentication to Django REST Framework (DRF).
    """
    def authenticate(self, request):
        if hasattr(request._request, 'user') and request._request.user.is_authenticated:
            return (request._request.user, None)
        return None
