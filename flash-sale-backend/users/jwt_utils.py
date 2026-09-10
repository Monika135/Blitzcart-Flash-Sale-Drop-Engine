import base64
import hmac
import hashlib
import json
import time
from django.conf import settings

ACCESS_TOKEN_TTL = 60 * 60 * 24  # 24 hours
REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30  # 30 days

def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')

def base64url_decode(data: str) -> bytes:
    padding = '=' * ((4 - len(data) % 4) % 4)
    return base64.urlsafe_b64decode(data + padding)

def _sign_token(payload: dict) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = base64url_encode(json.dumps(header).encode('utf-8'))
    payload_b64 = base64url_encode(json.dumps(payload).encode('utf-8'))

    signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
    signature = hmac.new(settings.SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
    signature_b64 = base64url_encode(signature)

    return f"{header_b64}.{payload_b64}.{signature_b64}"

def generate_token(user) -> str:
    """
    Generates a secure access JWT token for a user.
    """
    payload = {
        'user_id': user.id,
        'username': user.username,
        'token_type': 'access',
        'email': user.email,
        'exp': int(time.time()) + ACCESS_TOKEN_TTL
    }
    return _sign_token(payload)

def generate_refresh_token(user) -> str:
    """
    Generates a secure refresh JWT token for a user.
    """
    payload = {
        'user_id': user.id,
        'username': user.username,
        'email': user.email,
        'token_type': 'refresh',
        'exp': int(time.time()) + REFRESH_TOKEN_TTL
    }
    return _sign_token(payload)

def generate_tokens(user) -> dict:
    """
    Generates both access and refresh tokens for a user.
    """
    return {
        'access_token': generate_token(user),
        'refresh_token': generate_refresh_token(user),
    }

def decode_token(token: str, expected_token_type: str | None = None) -> dict | None:
    """
    Decodes and validates a JWT token. Returns the payload dict or None.
    """
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        
        header_b64, payload_b64, signature_b64 = parts
        
        signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
        expected_signature = hmac.new(settings.SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
        expected_signature_b64 = base64url_encode(expected_signature)
        
        # Use constant-time comparison to prevent timing attacks
        if not hmac.compare_digest(signature_b64, expected_signature_b64):
            return None
        
        payload = json.loads(base64url_decode(payload_b64).decode('utf-8'))
        
        # Check token expiration
        if 'exp' in payload:
            if time.time() > payload['exp']:
                return None

        if expected_token_type and payload.get('token_type') != expected_token_type:
            return None
                
        return payload
    except Exception:
        return None
