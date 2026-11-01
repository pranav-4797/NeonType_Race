"""Application settings"""
import secrets

# Generate a random 64‑character secret (keep this file safe!)
SECRET_KEY = secrets.token_urlsafe(48)

