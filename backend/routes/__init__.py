"""Routes package - Modular API routes organized by functionality"""
from .auth import router as auth_router
from .users import router as users_router
from .terminals import router as terminals_router
from .favorites import router as favorites_router

__all__ = [
    "auth_router",
    "users_router", 
    "terminals_router",
    "favorites_router"
]
