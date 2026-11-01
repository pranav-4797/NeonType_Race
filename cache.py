# cache.py
"""FastAPI cache utilities"""
from fastapi import FastAPI
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend

def init_cache(app: FastAPI) -> None:
    """Initialize an in‑memory cache for the app.
    For production you can swap InMemoryBackend with RedisBackend.
    """
    FastAPICache.init(InMemoryBackend(), prefix="neontype")

