# cookie_utils.py
"""Utility functions for signed player cookies.
Uses itsdangerous TimestampSigner to sign a simple pipe‑delimited payload
containing the player name and chosen difficulty.
"""
from itsdangerous import TimestampSigner, BadSignature, SignatureExpired
from fastapi import Response, Request
from settings import SECRET_KEY

# Signer with a 7‑day max age (in seconds)
signer = TimestampSigner(SECRET_KEY)
MAX_AGE = 7 * 24 * 60 * 60  # 7 days

def set_player_cookie(response: Response, name: str, difficulty: str) -> None:
    """Set a signed, HttpOnly cookie named ``player``.
    ``name`` – player display name (max 16 chars). ``difficulty`` – one of
    ``easy``, ``medium`` or ``hard``.
    """
    payload = f"{name}|{difficulty}".encode()
    signed = signer.sign(payload).decode()
    response.set_cookie(
        key="player",
        value=signed,
        max_age=MAX_AGE,
        httponly=True,
        samesite="Lax",
    )

def read_player_cookie(request: Request) -> tuple[str, str]:
    """Return ``(name, difficulty)`` from the signed ``player`` cookie.
    Returns empty strings if missing or invalid.
    """
    signed = request.cookies.get("player")
    if not signed:
        return "", ""
    try:
        payload = signer.unsign(signed, max_age=MAX_AGE).decode()
        name, difficulty = payload.split("|", 1)
        return name, difficulty
    except (BadSignature, SignatureExpired, ValueError):
        return "", ""

